import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import ai, alerts, analytics, connectors, dashboards, events, health, detection
from app.core.database import SessionLocal, engine
from app.services.alerts import service as alert_service
from app.services.domogpt_service import domogpt_service


def _alert_cycle() -> None:
    """One pass of the alert engine (runs in a worker thread, own DB session)."""
    db = SessionLocal()
    try:
        alert_service.ensure_alert_tables(engine)
        # Video library: reads the video metadata (a short subprocess) and checks the models, cached afterwards.
        from app.detection.library_service import list_video_library

        list_video_library()
        alert_service.sync_event_alerts(db)
        alert_service.run_reminder_cycle(db)
    finally:
        db.close()


async def _sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)


async def _alert_scheduler() -> None:
    log = logging.getLogger("ehs.alerts.scheduler")
    await _sleep(5)
    while True:
        try:
            await asyncio.to_thread(_alert_cycle)
        except asyncio.CancelledError:
            raise
        except Exception:  # never let a transient DB error kill the loop
            log.exception("Alert cycle failed; will retry")
        await _sleep(max(15, settings.EHS_ALERT_CYCLE_SECONDS))


def _warm_db_pool(connections: int = 4) -> None:
    from concurrent.futures import ThreadPoolExecutor

    from sqlalchemy import text

    def _ping(_: int) -> None:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

    try:
        with ThreadPoolExecutor(max_workers=connections) as pool:
            list(pool.map(_ping, range(connections)))
        # One-time table checks that otherwise run inside the first request that needs them.
        from app.api.routes import detection as detection_routes

        detection_routes._ensure_video_table()
        alert_service.ensure_alert_tables(engine)
    except Exception as exc:  # the first real request will retry; never block startup
        logging.getLogger("ehs.db").warning("Database warm-up failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Initialize separate Connector DB in background thread without blocking main app
    try:
        from app.connectors.database import init_connector_db
        await asyncio.to_thread(init_connector_db)
    except Exception as e:
        logging.getLogger("ehs.connectors").warning("Could not auto-initialize connector DB on startup: %s", e)

    # Open a few database connections now: the first connection to the (distant) database takes ~10 s, which the
    # first user would otherwise wait for. Runs in the background; the server answers requests meanwhile.
    asyncio.create_task(asyncio.to_thread(_warm_db_pool))

    scheduler = asyncio.create_task(_alert_scheduler()) if settings.EHS_ALERT_SCHEDULER else None
    try:
        yield
    finally:
        if scheduler:
            scheduler.cancel()
            try:
                await scheduler
            except asyncio.CancelledError:
                pass
        await domogpt_service.aclose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    description="Enterprise EHS & Safety AI Platform Backend — Grounded exclusively on verified Neon PostgreSQL operational datasets.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(dashboards.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(detection.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(alerts.notification_router, prefix=settings.API_V1_STR)
app.include_router(connectors.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": f"{settings.API_V1_STR}/docs",
        "datasets_status": "Connected to Neon PostgreSQL ehs_core schema",
    }

"""Safety net for the whole suite: tests must never run the real alert scheduler (it would write to
whatever database the app is configured with, i.e. the live Neon DB)."""
import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def _never_run_real_alert_scheduler(monkeypatch):
    monkeypatch.setattr(settings, "EHS_ALERT_SCHEDULER", False)
    yield


# ---------------------------------------------------------------------------------------------
# Hard guard: the suite runs with the real app configuration (live Neon DB for read-only tests).
# Any write statement on that engine aborts the test. Isolated sqlite engines created by tests
# are separate objects and are unaffected.
# ---------------------------------------------------------------------------------------------
import re  # noqa: E402

from sqlalchemy import event  # noqa: E402

from app.core.database import engine as _live_engine  # noqa: E402

_WRITE = re.compile(r"^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE|ALTER|GRANT|REVOKE)\b", re.IGNORECASE)


@event.listens_for(_live_engine, "before_cursor_execute")
def _refuse_live_writes(conn, cursor, statement, parameters, context, executemany):
    if _WRITE.match(statement) and "IF NOT EXISTS" not in statement.upper():
        raise RuntimeError(f"Tests must not write to the live database. Blocked: {statement[:90]!r}")


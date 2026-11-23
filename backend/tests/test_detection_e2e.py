"""
End-to-end detection test with the REAL CV worker (no stubs): upload a video, watch it being analysed,
check the stored original and the annotated result. Takes ~30-60 s and is skipped when the CV runtime or the
sample clip is missing. Runs against an in-memory sqlite database; the live Neon database is never touched.
"""
import glob
import os
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import alerts as alert_routes
from app.api.routes import detection as detection_routes
from app.core.database import get_db
from app.detection.config import ANNOTATED_VIDEO_DIR, BACKEND_ROOT, EVIDENCE_DIR, UPLOADED_VIDEO_DIR, runtime_problem
from app.main import app
from app.models.ehs_event import EhsEvent
from app.services.alerts import service

API = "/api/v1"
SAMPLE_GLOB = os.path.join(BACKEND_ROOT, "storage", "video_library", "smoke_fire", "*.mp4")


@pytest.fixture
def isolated_db(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.connect() as conn:
        conn.exec_driver_sql("ATTACH DATABASE ':memory:' AS ehs_core")
        conn.exec_driver_sql("CREATE TABLE video_safety_analyses (analysis_id TEXT)")  # same sqlite stand-in as test_alerts
        conn.commit()
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(detection_routes, "engine", engine)
    monkeypatch.setattr(detection_routes, "SessionLocal", Session)
    monkeypatch.setattr(detection_routes, "_ENSURED_ENGINES", set())
    monkeypatch.setattr(service, "_ENSURED", set())
    monkeypatch.setattr(alert_routes, "_LAST_SYNC", {"at": 1e18})

    def _get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    detection_routes._ensure_video_table()
    EhsEvent.__table__.create(bind=engine, checkfirst=True)
    service.ensure_alert_tables(engine)
    yield Session
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.skipif(runtime_problem() is not None, reason="CV runtime not installed (uv sync --group vision)")
@pytest.mark.skipif(not glob.glob(SAMPLE_GLOB), reason="no smoke_fire sample clip in storage/video_library")
def test_upload_is_analysed_stored_and_shown(isolated_db):
    sample = sorted(glob.glob(SAMPLE_GLOB))[0]
    video_bytes = open(sample, "rb").read()
    created = []
    with TestClient(app) as client:
        # 1. upload returns immediately, still processing
        res = client.post(
            API + "/detection/upload",
            files={"file": ("my_plant_video.mp4", video_bytes, "video/mp4")},
            data={"use_case": "smoke_fire", "plant_id": "IN-KA-01"},
        )
        assert res.status_code == 200, res.text
        first = res.json()
        analysis_id = first["analysis_id"]
        assert first["status"] == "PROCESSING" and first["filename"] == "my_plant_video.mp4"
        assert first["annotated_video_url"] is None
        assert first["original_video_url"] is not None  # stored on the server straight away
        created += [os.path.join(UPLOADED_VIDEO_DIR, f"{analysis_id}.mp4")]

        # 2. while analysing, progress and stage are reported
        seen_progress, seen_stages, last = [], set(), first
        deadline = time.time() + 240
        while time.time() < deadline:
            last = client.get(API + f"/detection/analyses/{analysis_id}").json()
            seen_progress.append(last["progress_pct"])
            if last["current_stage"]:
                seen_stages.add(last["current_stage"])
            if last["status"] != "PROCESSING":
                break
            time.sleep(1.0)
        created += [os.path.join(ANNOTATED_VIDEO_DIR, f"{analysis_id}_annotated.mp4"), os.path.join(EVIDENCE_DIR, f"{analysis_id}_evidence.jpg")]

        try:
            assert last["status"] in ("COMPLETED", "NEEDS_HUMAN_REVIEW"), last
            assert last["progress_pct"] == 100 and last["current_stage"] == "Completed"
            assert any(0 < p < 100 for p in seen_progress), f"progress never advanced: {seen_progress}"
            assert any("Scanning frames" in s for s in seen_stages), seen_stages
            assert last["frames_processed"] > 0 and last["model_used"]

            # 3. the annotated video (boxes drawn) is served
            assert last["annotated_video_url"]
            annotated = client.get(last["annotated_video_url"])
            assert annotated.status_code == 200 and annotated.headers["content-type"].startswith("video/")
            assert len(annotated.content) > 1000
            # it must be H.264: browsers cannot play the MPEG-4 Part 2 file OpenCV writes before the ffmpeg conversion
            import cv2

            cap = cv2.VideoCapture(os.path.join(ANNOTATED_VIDEO_DIR, f"{analysis_id}_annotated.mp4"))
            fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
            cap.release()
            codec = "".join(chr((fourcc >> 8 * i) & 0xFF) for i in range(4)).lower()
            assert codec in ("h264", "avc1"), f"annotated video is {codec!r}, not browser-playable H.264"

            # 4. the original upload is stored in one place and served back unchanged
            assert last["original_video_url"]
            original = client.get(last["original_video_url"])
            assert original.status_code == 200 and original.content == video_bytes
            assert os.path.isfile(os.path.join(UPLOADED_VIDEO_DIR, f"{analysis_id}.mp4"))

            # 5. it appears in the detection history with both links
            history = client.get(API + "/detection/analyses").json()
            row = next(r for r in history if r["analysis_id"] == analysis_id)
            assert row["original_video_url"] and row["annotated_video_url"]
        finally:
            for path in created:
                if os.path.exists(path):
                    os.remove(path)

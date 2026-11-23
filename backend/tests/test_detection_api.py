from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app


def test_video_model_status_endpoint():
    client = TestClient(app)
    res = client.get("/api/v1/detection/models/status")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 6
    by_case = {item["use_case"]: item for item in items}
    assert set(by_case.keys()) == {
        "fall_detection",
        "smoke_fire",
        "exit_obstruction",
        "forklift_pedestrian",
        "machinery_proximity",
        "unsafe_climbing",
    }
    # Truthful model readiness: a scenario is configured only with a verified model; otherwise it says so
    for case in ("forklift_pedestrian", "machinery_proximity", "unsafe_climbing"):
        if by_case[case]["configured"]:
            assert by_case[case]["model_name"]
        else:
            assert "not configured" in by_case[case]["message"].lower()

    for item in items:
        assert isinstance(item["configured"], bool)
        assert isinstance(item["message"], str) and len(item["message"]) > 0


def test_video_library_discovery_and_stream():
    client = TestClient(app)
    res = client.get("/api/v1/detection/library")
    assert res.status_code == 200
    data = res.json()
    assert data["total_scenarios_count"] == 6
    assert data["configured_models_count"] == sum(1 for g in data["groups"] if g["model_status"]["configured"])
    assert isinstance(data["total_videos"], int)
    assert len(data["groups"]) == 6

    all_videos = [v for grp in data["groups"] for v in grp["videos"]]
    assert len(all_videos) == data["total_videos"]
    if all_videos:
        sample = all_videos[0]
        assert sample["video_id"].startswith("LIB-")
        assert sample["available"] is True
        assert sample["file_size_bytes"] > 0
        # Verify streaming endpoint serves the discovered file cleanly
        stream_res = client.get(sample["stream_url"], headers={"Range": "bytes=0-1023"})
        assert stream_res.status_code in (200, 206)
        assert len(stream_res.content) > 0


def test_video_library_rejects_invalid_video_id():
    client = TestClient(app)
    res = client.get("/api/v1/detection/library/../../etc/passwd/stream")
    assert res.status_code in (400, 404)

    res2 = client.get("/api/v1/detection/library/LIB-FD-000000000000/stream")
    assert res2.status_code == 404

    res3 = client.post("/api/v1/detection/library/INVALID-ID/analyze", json={"plant_id": "ALL"})
    assert res3.status_code == 404


def test_unconfigured_scenario_upload_blocked_with_503(monkeypatch):
    from app.schemas.video import VideoModelAvailability
    import app.api.routes.detection as video_route

    monkeypatch.setattr(
        video_route,
        "_get_status_for_use_case",
        lambda uc: VideoModelAvailability(
            use_case=uc,
            title="Unconfigured Test Scenario",
            configured=False,
            model_name=None,
            backend_runtime="Unconfigured",
            message="Model not configured for test.",
            confidence_supported=False,
        ),
    )
    client = TestClient(app)
    res = client.post(
        "/api/v1/detection/analyze/forklift_pedestrian",
        files={"file": ("clip.mp4", b"0000", "video/mp4")},
        data={"plant_id": "ALL"},
    )
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "MODEL_NOT_CONFIGURED"


def test_video_upload_rejects_invalid_extension():
    client = TestClient(app)
    res = client.post(
        "/api/v1/detection/analyze/fall_detection",
        files={"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")},
        data={"plant_id": "ALL"},
    )
    assert res.status_code == 400
    assert "Unsupported video format" in res.json()["detail"]


def test_video_upload_rejects_empty_file():
    client = TestClient(app)
    res = client.post(
        "/api/v1/detection/analyze/smoke_fire",
        files={"file": ("empty.mp4", b"", "video/mp4")},
        data={"plant_id": "ALL"},
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_video_evidence_blocks_path_traversal():
    client = TestClient(app)
    res = client.get("/api/v1/detection/evidence/..secret.jpg")
    assert res.status_code == 400
    res2 = client.get("/api/v1/detection/evidence/VID-DOESNOTEXIST_evidence.jpg")
    assert res2.status_code == 404


def test_video_annotated_blocks_path_traversal():
    client = TestClient(app)
    res = client.get("/api/v1/detection/annotated/..secret.mp4")
    assert res.status_code == 400
    res2 = client.get("/api/v1/detection/annotated/VID-DOESNOTEXIST_annotated.mp4")
    assert res2.status_code == 404


def test_video_analysis_detail_not_found():
    client = TestClient(app)
    res = client.get("/api/v1/detection/analyses/VID-DOESNOTEXIST")
    assert res.status_code == 404


def test_video_analyses_list_endpoint():
    client = TestClient(app)
    res = client.get("/api/v1/detection/analyses?limit=5")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    for item in items:
        assert "video_id" in item
        assert "progress_pct" in item
        assert "detection_events" in item
        assert "annotated_video_url" in item
        assert "human_review_status" in item


# ----------------------------------------------------------------------------- POST /detection/upload
def test_upload_route_rejects_unknown_use_case_and_missing_file():
    client = TestClient(app)
    bad_case = client.post(
        "/api/v1/detection/upload",
        files={"file": ("clip.mp4", b"0000", "video/mp4")},
        data={"use_case": "not_a_scenario", "plant_id": "ALL"},
    )
    assert bad_case.status_code == 422
    assert client.post("/api/v1/detection/upload", data={"use_case": "fall_detection"}).status_code == 422


def test_upload_route_rejects_invalid_extension_and_empty_file():
    client = TestClient(app)
    bad_ext = client.post(
        "/api/v1/detection/upload",
        files={"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")},
        data={"use_case": "fall_detection", "plant_id": "ALL"},
    )
    assert bad_ext.status_code == 400 and "Unsupported video format" in bad_ext.json()["detail"]
    empty = client.post(
        "/api/v1/detection/upload",
        files={"file": ("empty.mp4", b"", "video/mp4")},
        data={"use_case": "smoke_fire", "plant_id": "ALL"},
    )
    assert empty.status_code == 400


def test_upload_route_starts_processing_job_and_returns_immediately(monkeypatch):
    import app.api.routes.detection as detection_route
    from app.schemas.video import VideoAnalysisResponse, VideoModelAvailability

    monkeypatch.setattr(detection_route, "_ensure_video_table", lambda: None)
    monkeypatch.setattr(
        detection_route,
        "_get_status_for_use_case",
        lambda uc: VideoModelAvailability(
            use_case=uc, title="t", configured=True, model_name="stub-model",
            backend_runtime="stub", message="ok", confidence_supported=False,
        ),
    )
    seen = {}

    def fake_enqueue(**kw):
        seen.update(kw)
        import os
        assert os.path.exists(kw["safe_temp_path"])  # the upload was received and stored
        os.remove(kw["safe_temp_path"])  # the real job deletes it after detection
        return VideoAnalysisResponse(
            analysis_id=kw["analysis_id"], use_case=kw["use_case"], video_id=None, plant_id=kw["plant_id"],
            filename=kw["filename"], duration_sec=None, status="PROCESSING", progress_pct=0, frames_processed=0,
            total_frames=None, current_stage="Queued for CV worker execution", event_detected=False,
            event_label=None, event_timestamp_sec=None, detection_events=[], confidence=None, confidence_note=None,
            evidence_frame_url=None, annotated_video_url=None, human_review_status="PENDING_REVIEW",
            human_review_comment=None, model_used=kw["model_name"], summary=kw["initial_summary"],
            error_message=None, created_at=datetime.utcnow(), completed_at=None,
        )

    monkeypatch.setattr(detection_route, "_enqueue_analysis_job", fake_enqueue)
    client = TestClient(app)
    res = client.post(
        "/api/v1/detection/upload",
        files={"file": ("floor.mp4", b"not-a-real-video-but-not-empty", "video/mp4")},
        data={"use_case": "fall_detection", "plant_id": "ALL"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "PROCESSING" and body["filename"] == "floor.mp4" and body["use_case"] == "fall_detection"
    assert body["analysis_id"].startswith("VID-")
    assert seen["video_id"] is None



# ----------------------------------------------------------------------------- GET /detection/uploads/{file}
def test_uploaded_video_route_serves_stored_files_and_blocks_bad_names():
    import os

    from app.detection.config import UPLOADED_VIDEO_DIR

    client = TestClient(app)
    path = os.path.join(UPLOADED_VIDEO_DIR, "VID-ABCDEF12.mp4")
    with open(path, "wb") as f:
        f.write(b"stored-video-bytes")
    try:
        ok = client.get("/api/v1/detection/uploads/VID-ABCDEF12.mp4")
        assert ok.status_code == 200 and ok.content == b"stored-video-bytes"
        assert ok.headers["content-type"].startswith("video/")
    finally:
        os.remove(path)
    assert client.get("/api/v1/detection/uploads/VID-ABCDEF12.mp4").status_code == 404
    assert client.get("/api/v1/detection/uploads/..secret.mp4").status_code == 400
    assert client.get("/api/v1/detection/uploads/not-a-vid-name.mp4").status_code == 400

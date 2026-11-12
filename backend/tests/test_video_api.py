from fastapi.testclient import TestClient

from app.main import app


def test_video_model_status_endpoint():
    client = TestClient(app)
    res = client.get("/api/v1/video/models/status")
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
    # Truthful model readiness: unconfigured scenarios MUST report configured=False
    for missing_case in ("forklift_pedestrian", "machinery_proximity", "unsafe_climbing"):
        assert by_case[missing_case]["configured"] is False
        assert "not configured" in by_case[missing_case]["message"].lower()

    for item in items:
        assert isinstance(item["configured"], bool)
        assert isinstance(item["message"], str) and len(item["message"]) > 0


def test_video_library_discovery_and_stream():
    client = TestClient(app)
    res = client.get("/api/v1/video/library")
    assert res.status_code == 200
    data = res.json()
    assert data["total_scenarios_count"] == 6
    assert data["configured_models_count"] == 3
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
    res = client.get("/api/v1/video/library/../../etc/passwd/stream")
    assert res.status_code in (400, 404)

    res2 = client.get("/api/v1/video/library/LIB-FD-000000000000/stream")
    assert res2.status_code == 404

    res3 = client.post("/api/v1/video/library/INVALID-ID/analyze", json={"plant_id": "ALL"})
    assert res3.status_code == 404


def test_unconfigured_scenario_upload_blocked_with_503():
    client = TestClient(app)
    res = client.post(
        "/api/v1/video/analyze/forklift_pedestrian",
        files={"file": ("clip.mp4", b"0000", "video/mp4")},
        data={"plant_id": "ALL"},
    )
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "MODEL_NOT_CONFIGURED"


def test_video_upload_rejects_invalid_extension():
    client = TestClient(app)
    res = client.post(
        "/api/v1/video/analyze/fall_detection",
        files={"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")},
        data={"plant_id": "ALL"},
    )
    assert res.status_code == 400
    assert "Unsupported video format" in res.json()["detail"]


def test_video_upload_rejects_empty_file():
    client = TestClient(app)
    res = client.post(
        "/api/v1/video/analyze/smoke_fire",
        files={"file": ("empty.mp4", b"", "video/mp4")},
        data={"plant_id": "ALL"},
    )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_video_evidence_blocks_path_traversal():
    client = TestClient(app)
    res = client.get("/api/v1/video/evidence/..secret.jpg")
    assert res.status_code == 400
    res2 = client.get("/api/v1/video/evidence/VID-DOESNOTEXIST_evidence.jpg")
    assert res2.status_code == 404


def test_video_annotated_blocks_path_traversal():
    client = TestClient(app)
    res = client.get("/api/v1/video/annotated/..secret.mp4")
    assert res.status_code == 400
    res2 = client.get("/api/v1/video/annotated/VID-DOESNOTEXIST_annotated.mp4")
    assert res2.status_code == 404


def test_video_analysis_detail_not_found():
    client = TestClient(app)
    res = client.get("/api/v1/video/analyses/VID-DOESNOTEXIST")
    assert res.status_code == 404


def test_video_analyses_list_endpoint():
    client = TestClient(app)
    res = client.get("/api/v1/video/analyses?limit=5")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    for item in items:
        assert "video_id" in item
        assert "progress_pct" in item
        assert "detection_events" in item
        assert "annotated_video_url" in item
        assert "human_review_status" in item

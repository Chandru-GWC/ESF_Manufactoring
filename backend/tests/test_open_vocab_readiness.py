"""Readiness gating for the OWLv2-based scenarios: missing or tampered models must read MODEL_NOT_CONFIGURED."""
import pytest

from app.detection import open_vocab_services as ov

CASES = [ov.get_forklift_status, ov.get_machinery_status, ov.get_ladder_status]


@pytest.mark.parametrize("fn", CASES)
def test_missing_weights_means_not_configured(fn, monkeypatch, tmp_path):
    monkeypatch.setattr(ov, "OWL_WEIGHTS", str(tmp_path / "model.safetensors"))
    st = fn()
    assert st.configured is False and st.model_name is None
    assert "not configured" in st.message.lower() and "OWLv2" in st.message


@pytest.mark.parametrize("fn", CASES)
def test_tampered_weights_fail_sha256_and_are_not_configured(fn, monkeypatch, tmp_path):
    bad = tmp_path / "model.safetensors"
    bad.write_bytes(b"not the real model")
    monkeypatch.setattr(ov, "OWL_WEIGHTS", str(bad))
    monkeypatch.setattr(ov, "OWL_DIR", str(tmp_path))
    st = fn()
    assert st.configured is False
    assert "sha-256" in st.message.lower()


@pytest.mark.parametrize("fn", CASES)
def test_missing_runtime_dependency_is_reported(fn, monkeypatch):
    monkeypatch.setattr(ov, "runtime_problem", lambda: "CV packages not installed (torch). Run: uv sync --group vision")
    st = fn()
    assert st.configured is False and "CV packages not installed" in st.message


def test_runtime_problem_detects_missing_interpreter_and_missing_packages(monkeypatch):
    from app.detection import config

    config.runtime_problem.cache_clear()
    monkeypatch.setattr(config, "DETECTION_PYTHON", "C:/does/not/exist/python.exe")
    assert "not found" in config.runtime_problem()

    config.runtime_problem.cache_clear()
    monkeypatch.setattr(config, "DETECTION_PYTHON", config.sys.executable)
    monkeypatch.setattr(config, "REQUIRED_CV_PACKAGES", ("definitely_not_a_real_package_xyz",))
    assert "definitely_not_a_real_package_xyz" in config.runtime_problem()
    config.runtime_problem.cache_clear()

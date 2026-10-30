"""Tests for model loading, scoring, risk levels and explanations.

A small model is trained once per test session into a temporary directory, so
the suite never depends on artifacts committed to the repository.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src import anomaly_score
from src.data_generator import generate_dataset
from src.predict import (
    ModelNotAvailableError,
    clear_cache,
    load_metadata,
    load_model,
    predict_access_anomaly,
    predict_batch,
)
from src.preprocessing import LABEL_COLUMN, SchemaError
from src.train import build_metadata, save_artifacts, train_model

NORMAL_REQUEST = {
    "doctor_specialty": "Cardiology",
    "record_type": "ECG",
    "purpose": "Diagnosis",
    "hospital_affiliation": "HOSP001",
    "requests_last_24h": 6,
    "requests_last_7d": 31,
    "requests_for_record_type": 18,
    "average_daily_requests": 5,
    "request_hour": 14,
    "emergency_flag": 0,
}

UNUSUAL_REQUEST = {
    "doctor_specialty": "Dermatology",
    "record_type": "Cardiac_Report",
    "purpose": "Research",
    "hospital_affiliation": "HOSP002",
    "requests_last_24h": 95,
    "requests_last_7d": 420,
    "requests_for_record_type": 380,
    "average_daily_requests": 4,
    "request_hour": 3,
    "emergency_flag": 0,
}


@pytest.fixture(scope="session")
def trained_artifacts(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    """Train a small model into a temporary directory."""
    directory = tmp_path_factory.mktemp("model")
    model_path = directory / "isolation_forest.joblib"
    metadata_path = directory / "metadata.json"

    frame = generate_dataset(samples=3000, anomaly_rate=0.05, random_state=42)
    pipeline, scores = train_model(frame, contamination=0.05, n_estimators=100)
    metadata = build_metadata(frame, scores, 0.05, 100, 42)
    save_artifacts(pipeline, metadata, model_path, metadata_path)
    return model_path, metadata_path


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    clear_cache()


def test_model_loads_successfully(trained_artifacts: tuple[Path, Path]) -> None:
    model_path, metadata_path = trained_artifacts
    pipeline = load_model(str(model_path))
    metadata = load_metadata(str(metadata_path))
    assert hasattr(pipeline, "decision_function")
    assert metadata["model"] == "IsolationForest"
    assert metadata["version"]


def test_missing_model_raises_clear_error(tmp_path: Path) -> None:
    with pytest.raises(ModelNotAvailableError, match="python src/train.py"):
        load_model(str(tmp_path / "absent.joblib"))


def test_normal_request_produces_valid_response(trained_artifacts: tuple[Path, Path]) -> None:
    model_path, metadata_path = trained_artifacts
    result = predict_access_anomaly(NORMAL_REQUEST, model_path, metadata_path)

    assert set(result) == {
        "anomaly_score", "anomaly_flag", "risk_level",
        "reasons", "decision_score", "model_version",
    }
    assert 0.0 <= result["anomaly_score"] <= 1.0
    assert isinstance(result["anomaly_flag"], bool)
    assert result["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert isinstance(result["reasons"], list)


def test_unusual_request_scores_higher_than_normal(
    trained_artifacts: tuple[Path, Path]
) -> None:
    model_path, metadata_path = trained_artifacts
    normal = predict_access_anomaly(NORMAL_REQUEST, model_path, metadata_path)
    unusual = predict_access_anomaly(UNUSUAL_REQUEST, model_path, metadata_path)

    assert unusual["anomaly_score"] > normal["anomaly_score"]
    assert unusual["anomaly_flag"] is True
    assert unusual["risk_level"] in {"MEDIUM", "HIGH"}
    assert unusual["reasons"]


def test_reasons_are_descriptive_not_accusatory(
    trained_artifacts: tuple[Path, Path]
) -> None:
    model_path, metadata_path = trained_artifacts
    result = predict_access_anomaly(UNUSUAL_REQUEST, model_path, metadata_path)
    forbidden = ["malicious", "unauthorized", "unauthorised", "attack", "criminal", "fraud"]
    joined = " ".join(result["reasons"]).lower()
    assert not any(word in joined for word in forbidden)


def test_missing_field_is_rejected(trained_artifacts: tuple[Path, Path]) -> None:
    model_path, metadata_path = trained_artifacts
    incomplete = {k: v for k, v in NORMAL_REQUEST.items() if k != "purpose"}
    with pytest.raises(SchemaError):
        predict_access_anomaly(incomplete, model_path, metadata_path)


def test_invalid_input_is_rejected(trained_artifacts: tuple[Path, Path]) -> None:
    model_path, metadata_path = trained_artifacts
    with pytest.raises(SchemaError):
        predict_access_anomaly(dict(NORMAL_REQUEST, request_hour="noon"),
                               model_path, metadata_path)


def test_unseen_category_does_not_crash(trained_artifacts: tuple[Path, Path]) -> None:
    model_path, metadata_path = trained_artifacts
    result = predict_access_anomaly(
        dict(NORMAL_REQUEST, doctor_specialty="Ophthalmology"), model_path, metadata_path
    )
    assert 0.0 <= result["anomaly_score"] <= 1.0


def test_batch_prediction_adds_columns(trained_artifacts: tuple[Path, Path]) -> None:
    model_path, metadata_path = trained_artifacts
    frame = generate_dataset(samples=200, random_state=11)
    scored = predict_batch(frame, model_path, metadata_path)
    for column in ["decision_score", "anomaly_score", "anomaly_flag", "risk_level"]:
        assert column in scored.columns
    assert len(scored) == len(frame)
    assert LABEL_COLUMN in scored.columns


def test_normalize_score_is_bounded_and_monotonic() -> None:
    low = anomaly_score.normalize_score(0.30, -0.10, 0.20)
    high = anomaly_score.normalize_score(-0.30, -0.10, 0.20)
    assert low == 0.0
    assert high == 1.0
    assert 0.0 < anomaly_score.normalize_score(0.05, -0.10, 0.20) < 1.0


def test_risk_levels_follow_thresholds() -> None:
    assert anomaly_score.classify_risk(0.10) == "LOW"
    assert anomaly_score.classify_risk(0.50) == "MEDIUM"
    assert anomaly_score.classify_risk(0.95) == "HIGH"


def test_build_reasons_is_empty_without_profile() -> None:
    assert anomaly_score.build_reasons(UNUSUAL_REQUEST, None) == []


def test_model_metadata_is_available(trained_artifacts: tuple[Path, Path]) -> None:
    _, metadata_path = trained_artifacts
    metadata = load_metadata(str(metadata_path))
    assert metadata["features"]
    assert metadata["hyperparameters"]["random_state"] == 42
    assert "score_calibration" in metadata
    assert "synthetic" in metadata["data_source"].lower()

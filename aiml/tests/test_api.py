"""Tests for the FastAPI service.

The tests point the service at a temporary model trained inside the fixture, so
they do not depend on whatever happens to be in ``models/``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient

from src import config
from src.data_generator import generate_dataset
from src.predict import clear_cache
from src.train import build_metadata, save_artifacts, train_model
from tests.test_prediction import NORMAL_REQUEST, UNUSUAL_REQUEST


@pytest.fixture(scope="module")
def client(tmp_path_factory: pytest.TempPathFactory) -> Iterator[TestClient]:
    """Train a model, repoint config at it and yield a test client."""
    directory = tmp_path_factory.mktemp("api_model")
    model_path = directory / "isolation_forest.joblib"
    metadata_path = directory / "metadata.json"

    frame = generate_dataset(samples=3000, anomaly_rate=0.05, random_state=42)
    pipeline, scores = train_model(frame, contamination=0.05, n_estimators=100)
    save_artifacts(pipeline, build_metadata(frame, scores, 0.05, 100, 42),
                   model_path, metadata_path)

    original_model, original_metadata = config.MODEL_PATH, config.METADATA_PATH
    config.MODEL_PATH, config.METADATA_PATH = model_path, metadata_path
    clear_cache()

    import api.main as api_main

    api_main.config.MODEL_PATH = model_path
    api_main.config.METADATA_PATH = metadata_path

    with TestClient(api_main.app) as test_client:
        yield test_client

    config.MODEL_PATH, config.METADATA_PATH = original_model, original_metadata
    clear_cache()


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["model_version"]


def test_predict_normal_request(client: TestClient) -> None:
    response = client.post("/predict", json=NORMAL_REQUEST)
    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["anomaly_score"] <= 1.0
    assert body["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert isinstance(body["reasons"], list)
    assert body["model_version"]


def test_predict_unusual_request(client: TestClient) -> None:
    response = client.post("/predict", json=UNUSUAL_REQUEST)
    assert response.status_code == 200
    body = response.json()
    assert body["anomaly_flag"] is True
    assert body["risk_level"] in {"MEDIUM", "HIGH"}
    assert body["reasons"]


def test_predict_rejects_missing_field(client: TestClient) -> None:
    payload = {k: v for k, v in NORMAL_REQUEST.items() if k != "record_type"}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_rejects_out_of_range_hour(client: TestClient) -> None:
    response = client.post("/predict", json=dict(NORMAL_REQUEST, request_hour=47))
    assert response.status_code == 422


def test_predict_rejects_wrong_type(client: TestClient) -> None:
    response = client.post("/predict", json=dict(NORMAL_REQUEST, requests_last_24h="many"))
    assert response.status_code == 422


def test_predict_rejects_unknown_field(client: TestClient) -> None:
    response = client.post("/predict", json=dict(NORMAL_REQUEST, patient_diagnosis="diabetes"))
    assert response.status_code == 422


def test_model_info_endpoint(client: TestClient) -> None:
    response = client.get("/model-info")
    assert response.status_code == 200
    body = response.json()
    assert body["algorithm"] == "Isolation Forest"
    assert len(body["features"]) == 10
    assert body["hyperparameters"]["contamination"] == 0.05
    assert "synthetic" in body["data_source"].lower()


def test_openapi_schema_is_served(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/predict" in response.json()["paths"]


def test_health_reports_degraded_without_model(tmp_path: Path) -> None:
    import api.main as api_main

    original_model, original_metadata = api_main.config.MODEL_PATH, api_main.config.METADATA_PATH
    api_main.config.MODEL_PATH = tmp_path / "absent.joblib"
    api_main.config.METADATA_PATH = tmp_path / "absent.json"
    clear_cache()

    with TestClient(api_main.app) as degraded_client:
        body = degraded_client.get("/health").json()
        assert body["status"] == "degraded"
        assert body["model_loaded"] is False
        assert degraded_client.post("/predict", json=NORMAL_REQUEST).status_code == 503

    api_main.config.MODEL_PATH, api_main.config.METADATA_PATH = original_model, original_metadata
    clear_cache()

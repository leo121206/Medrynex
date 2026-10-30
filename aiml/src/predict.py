"""Reusable prediction interface for the access-anomaly model.

This module has no web, database or blockchain dependencies. It accepts a plain
Python dictionary of access metadata and returns a plain dictionary result, so
it can be called from a script, a notebook, a test or the FastAPI service.

Usage:
    from src.predict import predict_access_anomaly

    result = predict_access_anomaly({...})
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

import joblib
import pandas as pd
from sklearn.pipeline import Pipeline

from src import config
from src.anomaly_score import build_result
from src.preprocessing import SchemaError, prepare_frame, record_to_frame

logger = logging.getLogger(__name__)


class ModelNotAvailableError(RuntimeError):
    """Raised when the trained model or its metadata cannot be loaded."""


@lru_cache(maxsize=4)
def _load_model_cached(model_path: str) -> Pipeline:
    path = Path(model_path)
    if not path.exists():
        raise ModelNotAvailableError(
            f"Model not found at {path}. Run: python src/train.py"
        )
    try:
        return joblib.load(path)
    except Exception as error:  # pragma: no cover - corrupt artifact
        raise ModelNotAvailableError(f"Failed to load model from {path}: {error}") from error


@lru_cache(maxsize=4)
def _load_metadata_cached(metadata_path: str) -> dict[str, Any]:
    path = Path(metadata_path)
    if not path.exists():
        raise ModelNotAvailableError(
            f"Model metadata not found at {path}. Run: python src/train.py"
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ModelNotAvailableError(f"Metadata at {path} is not valid JSON: {error}") from error


def load_model(model_path: str | Path | None = None) -> Pipeline:
    """Load and cache the fitted pipeline.

    Args:
        model_path: Optional override. Resolved at call time so that
            configuration changes take effect without reimporting.

    Raises:
        ModelNotAvailableError: If the artifact is missing or unreadable.
    """
    return _load_model_cached(str(model_path or config.MODEL_PATH))


def load_metadata(metadata_path: str | Path | None = None) -> dict[str, Any]:
    """Load and cache the model metadata document."""
    return _load_metadata_cached(str(metadata_path or config.METADATA_PATH))


def clear_cache() -> None:
    """Drop cached artifacts so the next call reloads them from disk."""
    _load_model_cached.cache_clear()
    _load_metadata_cached.cache_clear()


def predict_access_anomaly(
    request_data: Mapping[str, Any],
    model_path: str | Path | None = None,
    metadata_path: str | Path | None = None,
) -> dict[str, Any]:
    """Score a single access request.

    Args:
        request_data: Access metadata keyed by feature name.
        model_path: Optional override for the model artifact location.
        metadata_path: Optional override for the metadata location.

    Returns:
        ``{"anomaly_score", "anomaly_flag", "risk_level", "reasons",
        "decision_score", "model_version"}``

    Raises:
        SchemaError: If required fields are missing or malformed.
        ModelNotAvailableError: If the model has not been trained.
    """
    frame = record_to_frame(request_data)
    pipeline = load_model(model_path)
    metadata = load_metadata(metadata_path)

    decision_score = float(pipeline.decision_function(frame)[0])

    return build_result(
        decision_score=decision_score,
        record=request_data,
        calibration=metadata.get("score_calibration", {}),
        behaviour_profile=metadata.get("behaviour_profile"),
        model_version=str(metadata.get("version", config.MODEL_VERSION)),
    )


def predict_batch(
    frame: pd.DataFrame,
    model_path: str | Path | None = None,
    metadata_path: str | Path | None = None,
) -> pd.DataFrame:
    """Score a dataframe of access requests.

    Returns:
        A copy of ``frame`` with ``decision_score``, ``anomaly_score``,
        ``anomaly_flag`` and ``risk_level`` columns appended.
    """
    features = prepare_frame(frame)
    pipeline = load_model(model_path)
    metadata = load_metadata(metadata_path)
    calibration = metadata.get("score_calibration", {})

    decision_scores = pipeline.decision_function(features)
    results = [
        build_result(
            decision_score=float(score),
            record=record,
            calibration=calibration,
            behaviour_profile=None,
            model_version=str(metadata.get("version", config.MODEL_VERSION)),
        )
        for score, record in zip(decision_scores, features.to_dict(orient="records"))
    ]

    scored = frame.copy()
    scored["decision_score"] = [result["decision_score"] for result in results]
    scored["anomaly_score"] = [result["anomaly_score"] for result in results]
    scored["anomaly_flag"] = [result["anomaly_flag"] for result in results]
    scored["risk_level"] = [result["risk_level"] for result in results]
    return scored


def _demo() -> None:  # pragma: no cover - manual convenience
    logging.basicConfig(level=config.LOG_LEVEL, format="%(message)s")
    sample = {
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
    try:
        logger.info(json.dumps(predict_access_anomaly(sample), indent=2))
    except (SchemaError, ModelNotAvailableError) as error:
        logger.error("%s", error)


if __name__ == "__main__":
    _demo()

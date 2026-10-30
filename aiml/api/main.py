"""Standalone FastAPI service for access-anomaly scoring.

This service knows nothing about MediVault's blockchain, database, IPFS storage
or patient files. It accepts access metadata over HTTP and returns an ML result.
Any consent workflow, authorisation decision or on-chain action stays entirely
in the caller.

Run with:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src import config
from src.predict import (
    ModelNotAvailableError,
    clear_cache,
    load_metadata,
    load_model,
    predict_access_anomaly,
)
from src.preprocessing import SchemaError

logging.basicConfig(level=config.LOG_LEVEL, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class AccessRequest(BaseModel):
    """Access metadata for a single medical-record request."""

    doctor_specialty: str = Field(..., min_length=1, examples=["Cardiology"])
    record_type: str = Field(..., min_length=1, examples=["ECG"])
    purpose: str = Field(..., min_length=1, examples=["Diagnosis"])
    hospital_affiliation: str = Field(..., min_length=1, examples=["HOSP001"])
    requests_last_24h: int = Field(..., ge=0, le=10_000, examples=[6])
    requests_last_7d: int = Field(..., ge=0, le=100_000, examples=[31])
    requests_for_record_type: int = Field(..., ge=0, le=100_000, examples=[18])
    average_daily_requests: float = Field(..., ge=0, le=10_000, examples=[5])
    request_hour: int = Field(..., ge=0, le=23, examples=[14])
    emergency_flag: int = Field(..., ge=0, le=1, examples=[0])

    model_config = {"extra": "forbid"}


class PredictionResponse(BaseModel):
    """Result of scoring one access request."""

    anomaly_score: float = Field(..., description="Normalised 0.0-1.0; higher is more unusual.")
    anomaly_flag: bool = Field(..., description="True when the score crosses the review threshold.")
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    reasons: list[str] = Field(default_factory=list)
    decision_score: float = Field(..., description="Raw IsolationForest decision_function value.")
    model_version: str

    model_config = {"protected_namespaces": ()}


class HealthResponse(BaseModel):
    """Service liveness and model-readiness status."""

    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_version: str | None = None
    detail: str | None = None

    model_config = {"protected_namespaces": ()}


class ModelInfoResponse(BaseModel):
    """Metadata describing the currently loaded model."""

    model: str
    version: str
    algorithm: str
    trained_at: str | None = None
    training_samples: int | None = None
    features: list[str]
    hyperparameters: dict[str, Any]
    risk_thresholds: dict[str, Any]
    score_calibration: dict[str, Any]
    data_source: str

    model_config = {"protected_namespaces": ()}


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm the model cache at start-up; stay up if the model is missing."""
    clear_cache()
    try:
        load_model()
        load_metadata()
        logger.info("Model loaded and ready.")
    except ModelNotAvailableError as error:
        logger.warning("Starting without a model: %s", error)
    yield


app = FastAPI(
    title=config.API_TITLE,
    version=config.MODEL_VERSION,
    description=(
        "Unsupervised anomaly detection over clinician access metadata. "
        "Decision support only: it describes unusual access patterns and makes "
        "no claim about intent, authorisation or wrongdoing. Not a diagnostic system."
    ),
    lifespan=lifespan,
)


@app.exception_handler(SchemaError)
async def schema_error_handler(_, error: SchemaError) -> JSONResponse:
    """Translate schema problems into 422 responses."""
    return JSONResponse(status_code=422, content={"detail": str(error)})


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    """Report whether the service is up and whether a model is loaded."""
    try:
        load_model()
        metadata = load_metadata()
        return HealthResponse(
            status="ok", model_loaded=True, model_version=str(metadata.get("version"))
        )
    except ModelNotAvailableError as error:
        return HealthResponse(status="degraded", model_loaded=False, detail=str(error))


@app.post("/predict", response_model=PredictionResponse, tags=["inference"])
def predict(request: AccessRequest) -> PredictionResponse:
    """Score one access request and return an anomaly assessment."""
    try:
        result = predict_access_anomaly(request.model_dump())
    except ModelNotAvailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error
    except SchemaError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except Exception as error:  # pragma: no cover - unexpected failure
        logger.exception("Prediction failed.")
        raise HTTPException(status_code=500, detail="Prediction failed.") from error

    return PredictionResponse(**result)


@app.get("/model-info", response_model=ModelInfoResponse, tags=["system"])
def model_info() -> ModelInfoResponse:
    """Return metadata identifying the model that produces predictions."""
    try:
        metadata = load_metadata()
    except ModelNotAvailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error

    return ModelInfoResponse(
        model=str(metadata.get("model", "IsolationForest")),
        version=str(metadata.get("version", config.MODEL_VERSION)),
        algorithm=str(metadata.get("algorithm", "Isolation Forest")),
        trained_at=metadata.get("trained_at"),
        training_samples=metadata.get("training_samples"),
        features=list(metadata.get("features", [])),
        hyperparameters=dict(metadata.get("hyperparameters", {})),
        risk_thresholds=dict(metadata.get("risk_thresholds", {})),
        score_calibration=dict(metadata.get("score_calibration", {})),
        data_source=str(metadata.get("data_source", "synthetic")),
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("api.main:app", host=config.API_HOST, port=config.API_PORT, reload=True)

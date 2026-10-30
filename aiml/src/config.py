"""Central configuration for the MediVault AI anomaly-detection module.

Every tunable value lives here so that no other module hard-codes paths,
hyper-parameters or thresholds. Values may be overridden with environment
variables, which keeps the module portable and container-friendly.
"""

from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).resolve().parent.parent

DATA_DIR: Path = Path(os.getenv("MEDIVAULT_AI_DATA_DIR", str(BASE_DIR / "data")))
RAW_DATA_DIR: Path = DATA_DIR / "raw"
PROCESSED_DATA_DIR: Path = DATA_DIR / "processed"
MODELS_DIR: Path = Path(os.getenv("MEDIVAULT_AI_MODELS_DIR", str(BASE_DIR / "models")))

DATA_PATH: Path = Path(
    os.getenv("MEDIVAULT_AI_DATA_PATH", str(RAW_DATA_DIR / "access_patterns.csv"))
)
MODEL_PATH: Path = Path(
    os.getenv("MEDIVAULT_AI_MODEL_PATH", str(MODELS_DIR / "isolation_forest.joblib"))
)
METADATA_PATH: Path = Path(
    os.getenv("MEDIVAULT_AI_METADATA_PATH", str(MODELS_DIR / "metadata.json"))
)

# ---------------------------------------------------------------------------
# Model hyper-parameters
# ---------------------------------------------------------------------------
MODEL_VERSION: str = os.getenv("MEDIVAULT_AI_MODEL_VERSION", "1.0")
N_ESTIMATORS: int = int(os.getenv("MEDIVAULT_AI_N_ESTIMATORS", "200"))
CONTAMINATION: float = float(os.getenv("MEDIVAULT_AI_CONTAMINATION", "0.05"))
RANDOM_STATE: int = int(os.getenv("MEDIVAULT_AI_RANDOM_STATE", "42"))

# ---------------------------------------------------------------------------
# Synthetic data generation defaults
# ---------------------------------------------------------------------------
DEFAULT_SAMPLES: int = int(os.getenv("MEDIVAULT_AI_SAMPLES", "10000"))
DEFAULT_ANOMALY_RATE: float = float(os.getenv("MEDIVAULT_AI_ANOMALY_RATE", "0.05"))

# ---------------------------------------------------------------------------
# Risk scoring thresholds, applied to the normalised 0.0-1.0 anomaly score.
#
# These are operational defaults chosen for a demonstration system. They are
# NOT clinically validated and carry no regulatory or diagnostic meaning.
# ---------------------------------------------------------------------------
# 0.50 is the model's own inlier/outlier boundary under the configured
# contamination value, so the default flag agrees with the Isolation Forest.
ANOMALY_THRESHOLD: float = float(os.getenv("MEDIVAULT_AI_ANOMALY_THRESHOLD", "0.50"))
RISK_MEDIUM_THRESHOLD: float = float(os.getenv("MEDIVAULT_AI_RISK_MEDIUM", "0.45"))
RISK_HIGH_THRESHOLD: float = float(os.getenv("MEDIVAULT_AI_RISK_HIGH", "0.65"))

# ---------------------------------------------------------------------------
# Explanation sensitivity
# ---------------------------------------------------------------------------
ZSCORE_THRESHOLD: float = float(os.getenv("MEDIVAULT_AI_ZSCORE_THRESHOLD", "2.5"))
RARE_CATEGORY_FREQUENCY: float = float(os.getenv("MEDIVAULT_AI_RARE_FREQUENCY", "0.01"))
TYPICAL_HOUR_START: int = int(os.getenv("MEDIVAULT_AI_HOUR_START", "7"))
TYPICAL_HOUR_END: int = int(os.getenv("MEDIVAULT_AI_HOUR_END", "21"))

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
API_HOST: str = os.getenv("MEDIVAULT_AI_API_HOST", "0.0.0.0")
API_PORT: int = int(os.getenv("MEDIVAULT_AI_API_PORT", "8000"))
API_TITLE: str = "MediVault AI - Access Anomaly Detection"
LOG_LEVEL: str = os.getenv("MEDIVAULT_AI_LOG_LEVEL", "INFO")


def ensure_directories() -> None:
    """Create the data and model directories if they do not already exist."""
    for directory in (RAW_DATA_DIR, PROCESSED_DATA_DIR, MODELS_DIR):
        directory.mkdir(parents=True, exist_ok=True)

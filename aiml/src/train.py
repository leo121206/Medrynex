"""Train the Isolation Forest access-anomaly model.

The model is trained without labels. Labels present in the synthetic CSV are
used only by ``src/evaluate.py``; they are dropped here.

Usage:
    python src/train.py
    python src/train.py --data data/raw/access_patterns.csv --contamination 0.05
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline

try:
    from src import config
    from src.preprocessing import (
        CATEGORICAL_FEATURES,
        FEATURE_COLUMNS,
        NUMERIC_FEATURES,
        build_pipeline,
        prepare_frame,
    )
except ImportError:  # pragma: no cover - allows `python src/train.py`
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from src import config
    from src.preprocessing import (
        CATEGORICAL_FEATURES,
        FEATURE_COLUMNS,
        NUMERIC_FEATURES,
        build_pipeline,
        prepare_frame,
    )

logger = logging.getLogger(__name__)


def load_dataset(path: Path = config.DATA_PATH) -> pd.DataFrame:
    """Load the access-pattern CSV.

    Raises:
        FileNotFoundError: If the dataset has not been generated yet.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Run: python src/data_generator.py --samples 10000"
        )
    return pd.read_csv(path)


def build_behaviour_profile(frame: pd.DataFrame) -> dict[str, Any]:
    """Summarise the training distribution for use in explanations.

    Stores per-column means and standard deviations, category frequencies and
    specialty-conditional frequencies. These are descriptive statistics of the
    synthetic training set only.
    """
    numeric_stats = {
        column: {
            "mean": float(frame[column].mean()),
            "std": float(frame[column].std(ddof=0)),
            "p95": float(frame[column].quantile(0.95)),
        }
        for column in NUMERIC_FEATURES
    }

    category_frequencies = {
        column: {
            str(value): float(freq)
            for value, freq in frame[column].value_counts(normalize=True).items()
        }
        for column in CATEGORICAL_FEATURES
    }

    def conditional(target: str) -> dict[str, dict[str, float]]:
        grouped: dict[str, dict[str, float]] = {}
        for specialty, subset in frame.groupby("doctor_specialty"):
            grouped[str(specialty)] = {
                str(value): float(freq)
                for value, freq in subset[target].value_counts(normalize=True).items()
            }
        return grouped

    return {
        "numeric_stats": numeric_stats,
        "category_frequencies": category_frequencies,
        "specialty_record_frequencies": conditional("record_type"),
        "specialty_purpose_frequencies": conditional("purpose"),
    }


def train_model(
    frame: pd.DataFrame,
    contamination: float = config.CONTAMINATION,
    n_estimators: int = config.N_ESTIMATORS,
    random_state: int = config.RANDOM_STATE,
) -> tuple[Pipeline, np.ndarray]:
    """Fit the preprocessing + Isolation Forest pipeline.

    Returns:
        The fitted pipeline and the decision scores on the training data.
    """
    features = prepare_frame(frame)
    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
    )
    pipeline = build_pipeline(model)
    pipeline.fit(features)
    return pipeline, pipeline.decision_function(features)


def build_metadata(
    frame: pd.DataFrame,
    decision_scores: np.ndarray,
    contamination: float,
    n_estimators: int,
    random_state: int,
) -> dict[str, Any]:
    """Assemble the metadata document saved alongside the model."""
    return {
        "model": "IsolationForest",
        "version": config.MODEL_VERSION,
        "algorithm": "Isolation Forest",
        "library": "scikit-learn",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "training_samples": int(len(frame)),
        "features": FEATURE_COLUMNS,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "hyperparameters": {
            "n_estimators": n_estimators,
            "contamination": contamination,
            "random_state": random_state,
        },
        "random_state": random_state,
        "score_calibration": {
            "method": (
                "piecewise-linear rescaling of decision_function, anchored so that "
                "a raw score of 0.0 maps to 0.5 (the model decision boundary)"
            ),
            "decision_score_low": float(np.percentile(decision_scores, 1)),
            "decision_score_high": float(np.percentile(decision_scores, 99)),
            "decision_score_min": float(decision_scores.min()),
            "decision_score_max": float(decision_scores.max()),
        },
        "risk_thresholds": {
            "anomaly_flag_at": config.ANOMALY_THRESHOLD,
            "medium_at": config.RISK_MEDIUM_THRESHOLD,
            "high_at": config.RISK_HIGH_THRESHOLD,
            "note": "Operational defaults. Not clinically validated.",
        },
        "behaviour_profile": build_behaviour_profile(frame),
        "data_source": "synthetic (src/data_generator.py) - not real clinical data",
        "scope": "access metadata only; no diagnostic or clinical content is modelled",
    }


def save_artifacts(
    pipeline: Pipeline,
    metadata: dict[str, Any],
    model_path: Path = config.MODEL_PATH,
    metadata_path: Path = config.METADATA_PATH,
) -> None:
    """Persist the fitted pipeline and its metadata to disk."""
    Path(model_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_path)
    Path(metadata_path).write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the access-anomaly model.")
    parser.add_argument("--data", type=Path, default=config.DATA_PATH)
    parser.add_argument("--model-path", type=Path, default=config.MODEL_PATH)
    parser.add_argument("--metadata-path", type=Path, default=config.METADATA_PATH)
    parser.add_argument("--contamination", type=float, default=config.CONTAMINATION)
    parser.add_argument("--n-estimators", type=int, default=config.N_ESTIMATORS)
    parser.add_argument("--random-state", type=int, default=config.RANDOM_STATE)
    return parser.parse_args()


def main() -> None:
    """Command-line entry point."""
    logging.basicConfig(level=config.LOG_LEVEL, format="%(message)s")
    args = _parse_args()

    logger.info("Loading dataset...")
    frame = load_dataset(args.data)
    logger.info("Samples: %d\n", len(frame))

    logger.info("Preprocessing data...\n")
    logger.info("Training Isolation Forest...")
    pipeline, decision_scores = train_model(
        frame,
        contamination=args.contamination,
        n_estimators=args.n_estimators,
        random_state=args.random_state,
    )

    metadata = build_metadata(
        frame, decision_scores, args.contamination, args.n_estimators, args.random_state
    )
    save_artifacts(pipeline, metadata, args.model_path, args.metadata_path)

    flagged = int((pipeline.predict(prepare_frame(frame)) == -1).sum())
    logger.info("\nModel trained successfully.")
    logger.info("Contamination:      %.3f", args.contamination)
    logger.info("Estimators:         %d", args.n_estimators)
    logger.info("Flagged by model:   %d (%.2f%%)", flagged, 100 * flagged / len(frame))
    logger.info("Decision score p1:  %.6f", metadata["score_calibration"]["decision_score_low"])
    logger.info("Decision score p99: %.6f", metadata["score_calibration"]["decision_score_high"])
    logger.info("\nModel saved:\n%s", args.model_path)
    logger.info("Metadata saved:\n%s", args.metadata_path)


if __name__ == "__main__":
    main()

"""Evaluate the trained model against synthetic, labelled access patterns.

IMPORTANT SCOPE NOTE
--------------------
This is *synthetic anomaly evaluation*. The ground-truth labels come from
``src/data_generator.py``, which injects known deviations into invented data.
The metrics below measure how well the Isolation Forest recovers those injected
deviations. They say nothing about real-world detection of clinical record
misuse, which would require a governed dataset, human-adjudicated labels and a
separate validation study. No number in this file is a clinical validation
result.

Usage:
    python src/evaluate.py
    python src/evaluate.py --eval-samples 5000 --random-state 7
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)

try:
    from src import config
    from src.data_generator import generate_dataset
    from src.predict import predict_batch
    from src.preprocessing import LABEL_COLUMN
except ImportError:  # pragma: no cover - allows `python src/evaluate.py`
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from src import config
    from src.data_generator import generate_dataset
    from src.predict import predict_batch
    from src.preprocessing import LABEL_COLUMN

logger = logging.getLogger(__name__)


def evaluate_frame(frame: pd.DataFrame) -> dict[str, Any]:
    """Score a labelled dataframe and compute detection metrics.

    Args:
        frame: Data containing the feature columns plus ``is_anomaly``.

    Returns:
        A dictionary of metrics and dataset composition counts.
    """
    if LABEL_COLUMN not in frame.columns:
        raise ValueError(f"Evaluation data must contain the '{LABEL_COLUMN}' column.")

    scored = predict_batch(frame)
    y_true = scored[LABEL_COLUMN].astype(int)
    y_pred = scored["anomaly_flag"].astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    matrix = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = (int(value) for value in matrix.ravel())

    per_type: dict[str, Any] = {}
    if "anomaly_type" in scored.columns:
        anomalies = scored[scored[LABEL_COLUMN] == 1]
        for anomaly_type, subset in anomalies.groupby("anomaly_type"):
            per_type[str(anomaly_type)] = {
                "count": int(len(subset)),
                "detected": int(subset["anomaly_flag"].sum()),
                "recall": round(float(subset["anomaly_flag"].mean()), 4),
            }

    return {
        "note": "Synthetic anomaly evaluation. Not a real-world clinical validation.",
        "dataset": {
            "total_samples": int(len(scored)),
            "normal_samples": int((y_true == 0).sum()),
            "anomalous_samples": int((y_true == 1).sum()),
            "flagged_samples": int(y_pred.sum()),
            "percentage_flagged": round(100.0 * float(y_pred.mean()), 2),
        },
        "metrics": {
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "roc_auc_on_anomaly_score": round(
                float(roc_auc_score(y_true, scored["anomaly_score"])), 4
            ),
        },
        "confusion_matrix": {
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
            "true_positive": tp,
        },
        "risk_level_distribution": {
            str(level): int(count)
            for level, count in scored["risk_level"].value_counts().items()
        },
        "recall_by_anomaly_type": per_type,
        "classification_report": classification_report(
            y_true, y_pred, target_names=["normal", "anomalous"], zero_division=0
        ),
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate the access-anomaly model.")
    parser.add_argument("--eval-samples", type=int, default=5000,
                        help="Size of the freshly generated held-out evaluation set.")
    parser.add_argument("--anomaly-rate", type=float, default=config.DEFAULT_ANOMALY_RATE)
    parser.add_argument("--random-state", type=int, default=config.RANDOM_STATE + 1,
                        help="Seed for the evaluation set; differs from training by default.")
    parser.add_argument("--data", type=Path, default=None,
                        help="Evaluate an existing labelled CSV instead of generating one.")
    parser.add_argument("--report-path", type=Path,
                        default=config.PROCESSED_DATA_DIR / "evaluation_report.json")
    return parser.parse_args()


def main() -> None:
    """Command-line entry point."""
    logging.basicConfig(level=config.LOG_LEVEL, format="%(message)s")
    args = _parse_args()

    if args.data:
        logger.info("Loading evaluation data from %s...", args.data)
        frame = pd.read_csv(args.data)
    else:
        logger.info("Generating held-out synthetic evaluation set (seed %d)...", args.random_state)
        frame = generate_dataset(
            samples=args.eval_samples,
            anomaly_rate=args.anomaly_rate,
            random_state=args.random_state,
        )

    report = evaluate_frame(frame)

    logger.info("\n=== Synthetic Anomaly Evaluation ===")
    logger.info("%s\n", report["note"])
    for key, value in report["dataset"].items():
        logger.info("%-22s %s", key.replace("_", " ") + ":", value)
    logger.info("")
    for key, value in report["metrics"].items():
        logger.info("%-22s %s", key.replace("_", " ") + ":", value)
    logger.info("\nConfusion matrix:")
    matrix = report["confusion_matrix"]
    logger.info("                 predicted normal  predicted anomalous")
    logger.info("actual normal    %-17d %d", matrix["true_negative"], matrix["false_positive"])
    logger.info("actual anomalous %-17d %d", matrix["false_negative"], matrix["true_positive"])
    logger.info("\nRecall by injected anomaly type:")
    for anomaly_type, stats in report["recall_by_anomaly_type"].items():
        logger.info("  %-28s %d/%d  (%.2f)", anomaly_type, stats["detected"],
                    stats["count"], stats["recall"])
    logger.info("\n%s", report["classification_report"])

    args.report_path.parent.mkdir(parents=True, exist_ok=True)
    args.report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    logger.info("Report saved: %s", args.report_path)


if __name__ == "__main__":
    main()

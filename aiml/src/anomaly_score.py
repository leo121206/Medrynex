"""Conversion of Isolation Forest output into a user-facing risk score.

Two different numbers are involved and this module keeps them strictly apart:

1. ``decision_score`` - the raw ``IsolationForest.decision_function`` value.
   Positive values are inliers, negative values are outliers, and the zero
   point is set by the ``contamination`` parameter. This is a model-internal
   quantity with no fixed range.

2. ``anomaly_score`` - a normalised value in [0.0, 1.0] where higher means more
   unusual. It is a *piecewise-linear rescaling* of the decision score, anchored
   so that 0.5 corresponds exactly to the model's own inlier/outlier boundary
   (the point fixed by ``contamination``):

       decision >= 0:  anomaly_score = 0.5 * (1 - decision / s_hi)   -> [0.0, 0.5]
       decision <  0:  anomaly_score = 0.5 + 0.5 * (decision / s_lo) -> [0.5, 1.0]

   where ``s_lo`` and ``s_hi`` are the 1st and 99th percentile decision scores
   recorded during training (stored in ``models/metadata.json``). Both branches
   are clipped to their range.

   Consequence: a score at or above 0.5 means the Isolation Forest itself
   classifies the request as an outlier, and the distance above 0.5 indicates
   how far into the outlier region it sits.

The normalised score is a convenience for downstream systems. It is NOT a
probability, NOT a calibrated likelihood of misuse, and NOT clinically
validated. Risk thresholds are operational defaults set in ``src/config.py``.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping

from src import config
from src.preprocessing import CATEGORICAL_FEATURES, NUMERIC_FEATURES

logger = logging.getLogger(__name__)

RISK_LOW = "LOW"
RISK_MEDIUM = "MEDIUM"
RISK_HIGH = "HIGH"

# Wording is deliberately non-accusatory. This module describes behaviour; it
# does not assert intent, authorisation status or wrongdoing.
FREQUENCY_REASONS: dict[str, str] = {
    "requests_last_24h": "Request frequency in the last 24 hours is unusually high",
    "requests_last_7d": "Request volume over the last 7 days is unusually high",
    "requests_for_record_type": "Volume of requests for this record type is unusually high",
}


def normalize_score(
    decision_score: float, score_low: float, score_high: float
) -> float:
    """Rescale a raw decision-function value into a 0.0-1.0 anomaly score.

    The mapping is anchored at the model's own decision boundary: a raw score of
    exactly 0.0 always maps to 0.5, whatever the calibration range.

    Args:
        decision_score: Raw ``decision_function`` output.
        score_low: 1st-percentile training decision score (expected negative).
        score_high: 99th-percentile training decision score (expected positive).

    Returns:
        A value in [0.0, 1.0]; higher means more unusual.
    """
    if decision_score >= 0:
        upper = score_high if score_high > 0 else 1.0
        return float(min(0.5, max(0.0, 0.5 * (1.0 - decision_score / upper))))

    lower = score_low if score_low < 0 else -1.0
    return float(min(1.0, max(0.5, 0.5 + 0.5 * (decision_score / lower))))


def classify_risk(
    anomaly_score: float,
    medium_threshold: float = config.RISK_MEDIUM_THRESHOLD,
    high_threshold: float = config.RISK_HIGH_THRESHOLD,
) -> str:
    """Map a normalised anomaly score onto LOW / MEDIUM / HIGH.

    Thresholds are configurable and are operational defaults only.
    """
    if anomaly_score >= high_threshold:
        return RISK_HIGH
    if anomaly_score >= medium_threshold:
        return RISK_MEDIUM
    return RISK_LOW


def is_anomalous(
    anomaly_score: float, threshold: float = config.ANOMALY_THRESHOLD
) -> bool:
    """Return whether the normalised score crosses the review threshold."""
    return bool(anomaly_score >= threshold)


def build_reasons(
    record: Mapping[str, Any],
    behaviour_profile: Mapping[str, Any] | None,
    zscore_threshold: float = config.ZSCORE_THRESHOLD,
    rare_frequency: float = config.RARE_CATEGORY_FREQUENCY,
) -> list[str]:
    """Produce plain-language observations about why a request looks unusual.

    The explanations are descriptive statistics computed against the training
    distribution stored in the model metadata. They are a decision-support aid
    for a human reviewer, not a verdict about the clinician.

    Args:
        record: The access-request metadata.
        behaviour_profile: Training-set statistics from ``metadata.json``.
        zscore_threshold: How many standard deviations count as unusual.
        rare_frequency: Frequency below which a category counts as uncommon.

    Returns:
        A list of short observations, possibly empty.
    """
    if not behaviour_profile:
        return []

    reasons: list[str] = []
    numeric_stats: dict = behaviour_profile.get("numeric_stats", {})

    for column in NUMERIC_FEATURES:
        if column not in record or column not in numeric_stats:
            continue
        stats = numeric_stats[column]
        std = float(stats.get("std", 0.0))
        if std <= 0:
            continue
        z = (float(record[column]) - float(stats.get("mean", 0.0))) / std
        if z >= zscore_threshold and column in FREQUENCY_REASONS:
            reasons.append(FREQUENCY_REASONS[column])

    average = float(record.get("average_daily_requests", 0) or 0)
    if average > 0 and float(record.get("requests_last_24h", 0)) > 3 * average:
        message = "Recent request rate is well above this clinician's own daily average"
        if message not in reasons:
            reasons.append(message)

    category_frequencies: dict = behaviour_profile.get("category_frequencies", {})
    for column in CATEGORICAL_FEATURES:
        if column not in record:
            continue
        frequencies = category_frequencies.get(column, {})
        value = str(record[column])
        if frequencies and frequencies.get(value, 0.0) < rare_frequency:
            reasons.append(f"Value '{value}' for {column.replace('_', ' ')} is uncommon")

    specialty = str(record.get("doctor_specialty", ""))
    pair_frequencies: dict = behaviour_profile.get("specialty_record_frequencies", {})
    specialty_records = pair_frequencies.get(specialty, {})
    record_type = str(record.get("record_type", ""))
    if specialty_records and specialty_records.get(record_type, 0.0) < rare_frequency:
        reasons.append(
            f"Requested record type is uncommon for the {specialty.replace('_', ' ')} specialty"
        )

    purpose_frequencies: dict = behaviour_profile.get("specialty_purpose_frequencies", {})
    specialty_purposes = purpose_frequencies.get(specialty, {})
    purpose = str(record.get("purpose", ""))
    if specialty_purposes and specialty_purposes.get(purpose, 0.0) < rare_frequency:
        reasons.append("Stated purpose is uncommon for this specialty")

    hour = int(float(record.get("request_hour", 12)))
    emergency = int(float(record.get("emergency_flag", 0)))
    if not emergency and not (config.TYPICAL_HOUR_START <= hour <= config.TYPICAL_HOUR_END):
        reasons.append(
            "Access time falls outside typical working hours without an emergency flag"
        )

    return reasons


def build_result(
    decision_score: float,
    record: Mapping[str, Any],
    calibration: Mapping[str, float],
    behaviour_profile: Mapping[str, Any] | None = None,
    model_version: str = config.MODEL_VERSION,
) -> dict[str, Any]:
    """Assemble the full user-facing result for one access request.

    Returns:
        A dictionary with ``anomaly_score``, ``anomaly_flag``, ``risk_level``,
        ``reasons``, ``decision_score`` and ``model_version``.
    """
    anomaly_score = normalize_score(
        decision_score,
        float(calibration.get("decision_score_low", -0.1)),
        float(calibration.get("decision_score_high", 0.2)),
    )
    flagged = is_anomalous(anomaly_score)
    reasons = build_reasons(record, behaviour_profile) if flagged else []

    return {
        "anomaly_score": round(anomaly_score, 4),
        "anomaly_flag": flagged,
        "risk_level": classify_risk(anomaly_score),
        "reasons": reasons,
        "decision_score": round(float(decision_score), 6),
        "model_version": model_version,
    }

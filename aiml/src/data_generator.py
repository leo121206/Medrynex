"""Synthetic clinician access-pattern generator.

THIS FILE PRODUCES ENTIRELY SYNTHETIC DATA.
No real patient data, no real clinician data and no real hospital data is used,
derived from or contained in anything this module generates. The distributions
below are invented for development and demonstration purposes only, and they
are not claimed to reproduce the statistics of any real hospital system.

Only access/request metadata is generated. No diagnoses, symptoms, report
contents or medical images are modelled anywhere in this project.

Usage:
    python src/data_generator.py --samples 10000
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from src import config
    from src.preprocessing import FEATURE_COLUMNS, LABEL_COLUMN
except ImportError:  # pragma: no cover - allows `python src/data_generator.py`
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from src import config
    from src.preprocessing import FEATURE_COLUMNS, LABEL_COLUMN

logger = logging.getLogger(__name__)

HOSPITALS: list[str] = ["HOSP001", "HOSP002", "HOSP003", "HOSP004"]

# Behavioural profile per specialty: the record types and purposes that are
# routine for that specialty, plus a typical daily request volume band.
SPECIALTY_PROFILES: dict[str, dict] = {
    "Cardiology": {
        "record_types": {"ECG": 0.34, "Cardiac_Report": 0.28, "Blood_Report": 0.20,
                         "Prescription": 0.12, "Discharge_Summary": 0.06},
        "purposes": {"Diagnosis": 0.45, "Treatment": 0.35, "Follow_Up": 0.15,
                     "Second_Opinion": 0.05},
        "daily_requests": (4, 9),
        "hours": (8, 18),
    },
    "Dermatology": {
        "record_types": {"Skin_Report": 0.40, "Allergy_Record": 0.26,
                         "Biopsy_Report": 0.16, "Prescription": 0.12,
                         "Blood_Report": 0.06},
        "purposes": {"Diagnosis": 0.42, "Treatment": 0.38, "Follow_Up": 0.16,
                     "Second_Opinion": 0.04},
        "daily_requests": (3, 7),
        "hours": (9, 18),
    },
    "Neurology": {
        "record_types": {"Neuro_Report": 0.33, "MRI_Scan_Report": 0.30,
                         "CT_Scan_Report": 0.17, "Prescription": 0.11,
                         "Discharge_Summary": 0.09},
        "purposes": {"Diagnosis": 0.48, "Treatment": 0.30, "Follow_Up": 0.17,
                     "Second_Opinion": 0.05},
        "daily_requests": (3, 8),
        "hours": (8, 19),
    },
    "Orthopedics": {
        "record_types": {"XRay_Report": 0.38, "MRI_Scan_Report": 0.22,
                         "Surgery_Note": 0.18, "Prescription": 0.14,
                         "Discharge_Summary": 0.08},
        "purposes": {"Treatment": 0.44, "Diagnosis": 0.34, "Follow_Up": 0.18,
                     "Second_Opinion": 0.04},
        "daily_requests": (4, 10),
        "hours": (8, 18),
    },
    "Emergency_Medicine": {
        "record_types": {"Blood_Report": 0.26, "ECG": 0.20, "XRay_Report": 0.20,
                         "Discharge_Summary": 0.18, "CT_Scan_Report": 0.16},
        "purposes": {"Emergency": 0.58, "Diagnosis": 0.24, "Treatment": 0.16,
                     "Follow_Up": 0.02},
        "daily_requests": (9, 20),
        "hours": (0, 23),
    },
    "General_Medicine": {
        "record_types": {"Blood_Report": 0.32, "Prescription": 0.26,
                         "Discharge_Summary": 0.16, "XRay_Report": 0.14,
                         "Allergy_Record": 0.12},
        "purposes": {"Diagnosis": 0.38, "Treatment": 0.34, "Follow_Up": 0.24,
                     "Second_Opinion": 0.04},
        "daily_requests": (6, 14),
        "hours": (8, 20),
    },
}

ALL_RECORD_TYPES: list[str] = sorted(
    {record for profile in SPECIALTY_PROFILES.values() for record in profile["record_types"]}
)
ALL_PURPOSES: list[str] = sorted(
    {purpose for profile in SPECIALTY_PROFILES.values() for purpose in profile["purposes"]}
)

ANOMALY_TYPES: list[str] = [
    "high_frequency",
    "unusual_record_type",
    "unusual_purpose",
    "off_hours_access",
    "specialty_record_mismatch",
    "behavioural_drift",
]

OUTPUT_COLUMNS: list[str] = ["doctor_id"] + FEATURE_COLUMNS + [LABEL_COLUMN, "anomaly_type"]


def build_clinician_roster(
    rng: np.random.Generator, clinicians_per_specialty: int = 5
) -> list[dict]:
    """Create a roster of synthetic clinicians, each with a stable baseline.

    Each clinician keeps their own average daily request volume and hospital, so
    that "normal" means something slightly different per clinician.
    """
    roster: list[dict] = []
    counter = 1
    for specialty, profile in SPECIALTY_PROFILES.items():
        low, high = profile["daily_requests"]
        for _ in range(clinicians_per_specialty):
            roster.append(
                {
                    "doctor_id": f"DOC{counter:03d}",
                    "doctor_specialty": specialty,
                    "hospital_affiliation": str(rng.choice(HOSPITALS)),
                    "average_daily_requests": int(rng.integers(low, high + 1)),
                }
            )
            counter += 1
    return roster


def _weighted_choice(rng: np.random.Generator, weights: dict[str, float]) -> str:
    keys = list(weights)
    probabilities = np.array([weights[key] for key in keys], dtype=float)
    probabilities = probabilities / probabilities.sum()
    return str(rng.choice(keys, p=probabilities))


def _normal_hour(rng: np.random.Generator, hour_range: tuple[int, int]) -> int:
    start, end = hour_range
    if end - start >= 23:
        return int(rng.integers(0, 24))
    return int(np.clip(round(rng.normal((start + end) / 2, (end - start) / 4)), start, end))


def generate_normal_record(rng: np.random.Generator, clinician: dict) -> dict:
    """Generate one routine access request for a clinician."""
    profile = SPECIALTY_PROFILES[clinician["doctor_specialty"]]
    average = clinician["average_daily_requests"]

    record_type = _weighted_choice(rng, profile["record_types"])
    purpose = _weighted_choice(rng, profile["purposes"])

    requests_24h = int(max(0, rng.poisson(average)))
    requests_7d = int(max(requests_24h, rng.poisson(average * 7) + rng.integers(-3, 4)))
    share = profile["record_types"][record_type]
    requests_for_record_type = int(
        np.clip(rng.binomial(requests_7d, min(0.95, share + 0.05)), 0, requests_7d)
    )

    emergency_flag = int(purpose == "Emergency" or rng.random() < 0.03)
    hour = _normal_hour(rng, profile["hours"])
    if emergency_flag and rng.random() < 0.4:
        hour = int(rng.integers(0, 24))

    return {
        "doctor_id": clinician["doctor_id"],
        "doctor_specialty": clinician["doctor_specialty"],
        "record_type": record_type,
        "purpose": purpose,
        "hospital_affiliation": clinician["hospital_affiliation"],
        "requests_last_24h": requests_24h,
        "requests_last_7d": requests_7d,
        "requests_for_record_type": requests_for_record_type,
        "average_daily_requests": average,
        "request_hour": hour,
        "emergency_flag": emergency_flag,
        LABEL_COLUMN: 0,
        "anomaly_type": "none",
    }


def generate_anomalous_record(
    rng: np.random.Generator, clinician: dict, anomaly_type: str | None = None
) -> dict:
    """Generate one access request that deviates from the clinician's baseline.

    The label produced here is a *synthetic* label: it records which deviation
    was injected. It is not evidence of real-world misuse, and it is never shown
    to the Isolation Forest during training.
    """
    record = generate_normal_record(rng, clinician)
    profile = SPECIALTY_PROFILES[clinician["doctor_specialty"]]
    anomaly_type = anomaly_type or str(rng.choice(ANOMALY_TYPES))
    average = clinician["average_daily_requests"]

    if anomaly_type == "high_frequency":
        multiplier = float(rng.uniform(5.0, 11.0))
        record["requests_last_24h"] = int(average * multiplier)
        record["requests_last_7d"] = int(record["requests_last_24h"] * rng.uniform(1.2, 2.0))
        record["requests_for_record_type"] = int(
            record["requests_last_7d"] * rng.uniform(0.6, 0.95)
        )

    elif anomaly_type == "unusual_record_type":
        foreign = [r for r in ALL_RECORD_TYPES if r not in profile["record_types"]]
        record["record_type"] = str(rng.choice(foreign or ALL_RECORD_TYPES))
        record["requests_for_record_type"] = int(rng.integers(1, 4))

    elif anomaly_type == "unusual_purpose":
        foreign = [p for p in ALL_PURPOSES if p not in profile["purposes"]] or ["Research"]
        record["purpose"] = str(rng.choice(foreign + ["Research", "Audit"]))
        record["emergency_flag"] = 0

    elif anomaly_type == "off_hours_access":
        record["request_hour"] = int(rng.choice([0, 1, 2, 3, 4, 23]))
        record["emergency_flag"] = 0
        record["requests_last_24h"] = int(average * rng.uniform(2.0, 4.0))

    elif anomaly_type == "specialty_record_mismatch":
        foreign = [r for r in ALL_RECORD_TYPES if r not in profile["record_types"]]
        record["record_type"] = str(rng.choice(foreign or ALL_RECORD_TYPES))
        record["purpose"] = str(rng.choice(["Research", "Audit", "Second_Opinion"]))
        record["requests_for_record_type"] = int(rng.integers(1, 3))

    else:  # behavioural_drift
        record["requests_last_7d"] = int(average * 7 * rng.uniform(3.0, 6.0))
        record["requests_for_record_type"] = int(
            record["requests_last_7d"] * rng.uniform(0.75, 0.98)
        )
        record["requests_last_24h"] = int(average * rng.uniform(2.5, 5.0))
        record["request_hour"] = int(rng.choice([5, 6, 22, 23]))

    record[LABEL_COLUMN] = 1
    record["anomaly_type"] = anomaly_type
    return record


def generate_dataset(
    samples: int = config.DEFAULT_SAMPLES,
    anomaly_rate: float = config.DEFAULT_ANOMALY_RATE,
    random_state: int = config.RANDOM_STATE,
    clinicians_per_specialty: int = 5,
) -> pd.DataFrame:
    """Generate a synthetic access-pattern dataset.

    Args:
        samples: Total number of access requests to generate.
        anomaly_rate: Fraction of requests that carry an injected deviation.
        random_state: Seed, so that datasets are reproducible.
        clinicians_per_specialty: Size of the synthetic clinician roster.

    Returns:
        A dataframe with the feature columns plus ``is_anomaly`` and
        ``anomaly_type`` label columns used only for evaluation.
    """
    if samples <= 0:
        raise ValueError("samples must be a positive integer.")
    if not 0.0 <= anomaly_rate < 1.0:
        raise ValueError("anomaly_rate must be in the interval [0.0, 1.0).")

    rng = np.random.default_rng(random_state)
    roster = build_clinician_roster(rng, clinicians_per_specialty)

    anomaly_count = int(round(samples * anomaly_rate))
    normal_count = samples - anomaly_count

    rows = [
        generate_normal_record(rng, roster[int(rng.integers(0, len(roster)))])
        for _ in range(normal_count)
    ]
    rows += [
        generate_anomalous_record(rng, roster[int(rng.integers(0, len(roster)))])
        for _ in range(anomaly_count)
    ]

    frame = pd.DataFrame(rows)[OUTPUT_COLUMNS]
    return frame.sample(frac=1.0, random_state=random_state).reset_index(drop=True)


def save_dataset(frame: pd.DataFrame, path: Path = config.DATA_PATH) -> Path:
    """Write the dataset to CSV, creating the parent directory if needed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a synthetic clinician access-pattern dataset."
    )
    parser.add_argument("--samples", type=int, default=config.DEFAULT_SAMPLES,
                        help="Total number of access requests to generate.")
    parser.add_argument("--anomaly-rate", type=float, default=config.DEFAULT_ANOMALY_RATE,
                        help="Fraction of requests with an injected deviation.")
    parser.add_argument("--random-state", type=int, default=config.RANDOM_STATE,
                        help="Random seed for reproducibility.")
    parser.add_argument("--output", type=Path, default=config.DATA_PATH,
                        help="Destination CSV path.")
    return parser.parse_args()


def main() -> None:
    """Command-line entry point."""
    logging.basicConfig(level=config.LOG_LEVEL, format="%(message)s")
    args = _parse_args()

    logger.info("Generating synthetic access patterns (SYNTHETIC DATA ONLY)...")
    frame = generate_dataset(
        samples=args.samples,
        anomaly_rate=args.anomaly_rate,
        random_state=args.random_state,
    )
    path = save_dataset(frame, args.output)

    logger.info("Samples:           %d", len(frame))
    logger.info("Normal samples:    %d", int((frame[LABEL_COLUMN] == 0).sum()))
    logger.info("Anomalous samples: %d", int((frame[LABEL_COLUMN] == 1).sum()))
    logger.info("Clinicians:        %d", frame["doctor_id"].nunique())
    logger.info("Saved: %s", path)


if __name__ == "__main__":
    main()

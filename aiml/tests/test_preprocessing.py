"""Tests for the shared schema, preprocessing pipeline and data generator."""

from __future__ import annotations

import pandas as pd
import pytest

from src.data_generator import generate_dataset
from src.preprocessing import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    LABEL_COLUMN,
    NUMERIC_FEATURES,
    SchemaError,
    build_preprocessor,
    prepare_frame,
    record_to_frame,
    validate_columns,
)

VALID_RECORD = {
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


def test_feature_schema_is_consistent() -> None:
    assert FEATURE_COLUMNS == CATEGORICAL_FEATURES + NUMERIC_FEATURES
    assert LABEL_COLUMN not in FEATURE_COLUMNS


def test_record_to_frame_orders_columns() -> None:
    frame = record_to_frame(VALID_RECORD)
    assert list(frame.columns) == FEATURE_COLUMNS
    assert len(frame) == 1


def test_missing_field_is_rejected() -> None:
    incomplete = {key: value for key, value in VALID_RECORD.items() if key != "request_hour"}
    with pytest.raises(SchemaError, match="request_hour"):
        record_to_frame(incomplete)


def test_non_numeric_value_is_rejected() -> None:
    invalid = dict(VALID_RECORD, requests_last_24h="many")
    with pytest.raises(SchemaError):
        record_to_frame(invalid)


def test_non_mapping_input_is_rejected() -> None:
    with pytest.raises(SchemaError):
        record_to_frame(["not", "a", "mapping"])  # type: ignore[arg-type]


def test_validate_columns_reports_all_missing() -> None:
    frame = pd.DataFrame([{"doctor_specialty": "Cardiology"}])
    with pytest.raises(SchemaError) as error:
        validate_columns(frame)
    assert "record_type" in str(error.value)


def test_preprocessor_handles_unseen_categories() -> None:
    frame = prepare_frame(pd.DataFrame([VALID_RECORD]))
    preprocessor = build_preprocessor()
    preprocessor.fit(frame)

    unseen = prepare_frame(pd.DataFrame([dict(VALID_RECORD, record_type="Unknown_Type")]))
    transformed = preprocessor.transform(unseen)
    assert transformed.shape[0] == 1


def test_generated_dataset_has_expected_shape_and_labels() -> None:
    frame = generate_dataset(samples=500, anomaly_rate=0.1, random_state=1)
    assert len(frame) == 500
    for column in FEATURE_COLUMNS + [LABEL_COLUMN, "anomaly_type", "doctor_id"]:
        assert column in frame.columns
    assert int(frame[LABEL_COLUMN].sum()) == 50
    assert frame["request_hour"].between(0, 23).all()
    assert frame["emergency_flag"].isin([0, 1]).all()
    assert frame["doctor_id"].nunique() > 1


def test_generated_dataset_is_reproducible() -> None:
    first = generate_dataset(samples=200, random_state=7)
    second = generate_dataset(samples=200, random_state=7)
    pd.testing.assert_frame_equal(first, second)


def test_invalid_generation_arguments_are_rejected() -> None:
    with pytest.raises(ValueError):
        generate_dataset(samples=0)
    with pytest.raises(ValueError):
        generate_dataset(samples=100, anomaly_rate=1.5)

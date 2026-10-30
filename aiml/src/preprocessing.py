"""Feature schema and the single shared preprocessing pipeline.

This module is the only place where the feature schema and the encoding
strategy are defined. Training, evaluation, prediction and the API all import
from here, so the transformation applied at prediction time is by construction
identical to the one applied at training time.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Typical working-hours window used by the derived off-hours feature. Mirrors
# src.config but is duplicated as a module constant to keep this module free of
# import cycles; override via src.config for explanation logic.
TYPICAL_HOUR_START: int = 7
TYPICAL_HOUR_END: int = 21

# ---------------------------------------------------------------------------
# Feature schema
# ---------------------------------------------------------------------------
CATEGORICAL_FEATURES: list[str] = [
    "doctor_specialty",
    "record_type",
    "purpose",
    "hospital_affiliation",
]

NUMERIC_FEATURES: list[str] = [
    "requests_last_24h",
    "requests_last_7d",
    "requests_for_record_type",
    "average_daily_requests",
    "request_hour",
    "emergency_flag",
]

FEATURE_COLUMNS: list[str] = CATEGORICAL_FEATURES + NUMERIC_FEATURES

# Present in generated datasets for evaluation only. It is never a model input:
# the Isolation Forest is trained without labels.
LABEL_COLUMN: str = "is_anomaly"

# Bookkeeping columns kept in the CSV for readability, not used as features.
METADATA_COLUMNS: list[str] = ["doctor_id", "anomaly_type"]


class SchemaError(ValueError):
    """Raised when input data does not match the expected feature schema."""


def validate_columns(
    df: pd.DataFrame, required: Sequence[str] = tuple(FEATURE_COLUMNS)
) -> None:
    """Check that every required feature column is present.

    Args:
        df: The dataframe to validate.
        required: Column names that must be present.

    Raises:
        SchemaError: If one or more required columns are missing.
    """
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise SchemaError(f"Missing required column(s): {', '.join(sorted(missing))}")


def coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``df`` with feature columns cast to the expected types.

    Categorical features become strings, numeric features become floats. Any
    value that cannot be converted to a number raises ``SchemaError`` rather
    than silently becoming ``NaN``.
    """
    out = df.copy()

    for column in CATEGORICAL_FEATURES:
        if column in out.columns:
            out[column] = out[column].astype(str).str.strip()

    for column in NUMERIC_FEATURES:
        if column in out.columns:
            converted = pd.to_numeric(out[column], errors="coerce")
            if converted.isna().any():
                raise SchemaError(f"Column '{column}' contains non-numeric values.")
            out[column] = converted.astype(float)

    return out


def prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Validate, type-coerce and column-order a dataframe for the pipeline."""
    validate_columns(df)
    return coerce_types(df)[FEATURE_COLUMNS]


def record_to_frame(record: Mapping[str, Any]) -> pd.DataFrame:
    """Convert a single access-request dictionary into a one-row dataframe.

    Args:
        record: Access metadata keyed by feature name.

    Returns:
        A validated, correctly ordered single-row dataframe.

    Raises:
        SchemaError: If fields are missing or of the wrong type.
    """
    if not isinstance(record, Mapping):
        raise SchemaError("Access request must be a mapping of field names to values.")
    return prepare_frame(pd.DataFrame([dict(record)]))


class DerivedFeatures(BaseEstimator, TransformerMixin):
    """Stateless transformer producing behaviour ratios from the raw counts.

    The raw counts are absolute, so a busy emergency physician and a quiet
    dermatologist are not comparable on volume alone. These ratios express each
    request relative to the clinician's own declared baseline, which is what
    "unusual for this clinician" actually means.

    Output columns:
        burst_ratio            requests_last_24h / average_daily_requests
        weekly_ratio           requests_last_7d / (7 * average_daily_requests)
        record_concentration   share of the week's requests for this record type
        off_hours              1 when outside typical hours with no emergency flag
        hour_sin, hour_cos     cyclic encoding of the request hour
    """

    feature_names_: list[str] = [
        "burst_ratio",
        "weekly_ratio",
        "record_concentration",
        "off_hours",
        "hour_sin",
        "hour_cos",
    ]

    def fit(self, X: pd.DataFrame, y: Any = None) -> "DerivedFeatures":
        """No state is learned; present for scikit-learn compatibility."""
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """Compute the derived columns for every row of ``X``."""
        frame = pd.DataFrame(X).copy()
        baseline = frame["average_daily_requests"].astype(float).clip(lower=0.5)
        hour = frame["request_hour"].astype(float)
        emergency = frame["emergency_flag"].astype(float)

        out = pd.DataFrame(index=frame.index)
        out["burst_ratio"] = frame["requests_last_24h"].astype(float) / baseline
        out["weekly_ratio"] = frame["requests_last_7d"].astype(float) / (7.0 * baseline)
        out["record_concentration"] = frame["requests_for_record_type"].astype(float) / (
            frame["requests_last_7d"].astype(float) + 1.0
        )
        outside = (hour < TYPICAL_HOUR_START) | (hour > TYPICAL_HOUR_END)
        out["off_hours"] = (outside & (emergency == 0)).astype(float)
        out["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
        out["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
        return out.to_numpy(dtype=float)

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        """Return the names of the generated columns."""
        return np.asarray(self.feature_names_, dtype=object)


class ContextualFrequencyEncoder(BaseEstimator, TransformerMixin):
    """Encode how common each categorical value is *in its context*.

    One-hot encoding cannot express "an MRI report is routine for a neurologist
    but unusual for a dermatologist", because the two facts live in separate
    columns and the model would have to learn the interaction. This transformer
    learns conditional frequencies from the training data and emits them as
    numeric rarity features, so an unusual pairing lands near zero on a
    dedicated axis that the Isolation Forest can isolate directly.

    Values never seen during training receive a frequency of 0.0.
    """

    def __init__(self, context_column: str = "doctor_specialty") -> None:
        self.context_column = context_column

    def fit(self, X: pd.DataFrame, y: Any = None) -> "ContextualFrequencyEncoder":
        """Learn marginal and context-conditional category frequencies."""
        frame = pd.DataFrame(X)
        self.targets_ = [c for c in CATEGORICAL_FEATURES if c != self.context_column]

        self.marginal_: dict[str, dict[str, float]] = {
            column: frame[column].value_counts(normalize=True).to_dict()
            for column in CATEGORICAL_FEATURES
        }
        self.conditional_: dict[str, dict[str, dict[str, float]]] = {}
        for column in self.targets_:
            grouped: dict[str, dict[str, float]] = {}
            for context, subset in frame.groupby(self.context_column):
                grouped[str(context)] = subset[column].value_counts(normalize=True).to_dict()
            self.conditional_[column] = grouped
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """Map each row onto its marginal and conditional frequency values."""
        frame = pd.DataFrame(X)
        contexts = frame[self.context_column].astype(str)
        columns: list[pd.Series] = []

        for column in CATEGORICAL_FEATURES:
            lookup = self.marginal_.get(column, {})
            columns.append(frame[column].astype(str).map(lookup).fillna(0.0))

        for column in self.targets_:
            grouped = self.conditional_.get(column, {})
            values = [
                float(grouped.get(str(context), {}).get(str(value), 0.0))
                for context, value in zip(contexts, frame[column].astype(str))
            ]
            columns.append(pd.Series(values, index=frame.index))

        return np.column_stack([series.to_numpy(dtype=float) for series in columns])

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        """Return the names of the generated frequency columns."""
        names = [f"freq_{column}" for column in CATEGORICAL_FEATURES]
        names += [f"freq_{column}_given_{self.context_column}" for column in self.targets_]
        return np.asarray(names, dtype=object)


def build_preprocessor() -> ColumnTransformer:
    """Build the preprocessing transformer used for every fit and predict call.

    Two blocks are combined, both computed from the same ten contract inputs:

    * ``derived`` - behaviour ratios and cyclic time features
      (:class:`DerivedFeatures`).
    * ``frequency`` - marginal and specialty-conditional category frequencies
      (:class:`ContextualFrequencyEncoder`).

    Raw one-hot columns and raw absolute counts are deliberately *not* passed
    through. Isolation Forest chooses a split feature uniformly at random, so
    every uninformative column dilutes the informative ones. The one-hot block
    added roughly thirty near-noise dimensions and the raw counts are already
    represented, in clinician-relative form, by the ratio features. Measured on
    a held-out synthetic set, dropping both blocks raised ROC-AUC from 0.91 to
    0.96 (see ``src/evaluate.py`` to reproduce).

    The API contract is unaffected: callers still send the ten documented
    fields, and these columns exist only inside the pipeline.
    """
    scaled_derived = Pipeline(
        steps=[("derive", DerivedFeatures()), ("scale", StandardScaler())]
    )
    scaled_frequency = Pipeline(
        steps=[("encode", ContextualFrequencyEncoder()), ("scale", StandardScaler())]
    )

    return ColumnTransformer(
        transformers=[
            ("derived", scaled_derived, FEATURE_COLUMNS),
            ("frequency", scaled_frequency, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def build_pipeline(model: Any) -> Pipeline:
    """Wrap an estimator together with the shared preprocessor.

    Persisting this single object means the encoder, the scaler and the model
    can never drift out of sync between training and serving.
    """
    return Pipeline(steps=[("preprocessor", build_preprocessor()), ("model", model)])

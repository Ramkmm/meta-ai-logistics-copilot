
"""Synthetic shipment delay-risk model for the LogiCopilot hackathon.

This prototype uses synthetic data only. Its metrics are not
evidence of real-world shipment prediction performance.
"""

from datetime import datetime, timedelta, timezone
from functools import lru_cache
import gc

import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


FEATURES = [
    "distance_km",
    "planned_transit_hours",
    "carrier_delay_rate",
    "weather_severity",
    "traffic_severity",
    "customs_risk",
    "hub_congestion",
]

MODEL_VERSION = "synthetic-logistic-regression-v1"


def generate_synthetic_shipments(n=5000, seed=42):
    """Generate reproducible synthetic shipment records."""
    rng = np.random.default_rng(seed)

    data = {
        "shipment_date": [
            datetime(2025, 1, 1, tzinfo=timezone.utc)
            + timedelta(hours=6 * i)
            for i in range(n)
        ],
        "distance_km": rng.integers(30, 2501, n).astype(float),
        "planned_transit_hours": rng.uniform(4, 120, n),
        "carrier_delay_rate": rng.uniform(0.02, 0.55, n),
        "weather_severity": rng.integers(0, 5, n).astype(float),
        "traffic_severity": rng.integers(0, 5, n).astype(float),
        "customs_risk": rng.integers(0, 2, n).astype(float),
        "hub_congestion": rng.integers(0, 5, n).astype(float),
    }

    log_odds = (
        -2.8
        + 0.85 * data["carrier_delay_rate"]
        + 0.34 * data["weather_severity"]
        + 0.28 * data["traffic_severity"]
        + 0.85 * data["customs_risk"]
        + 0.24 * data["hub_congestion"]
        + 0.006 * np.maximum(
            data["planned_transit_hours"] - 48, 0
        )
        + 0.00015 * data["distance_km"]
    )

    probability = 1 / (1 + np.exp(-log_odds))
    data["delayed"] = rng.binomial(1, probability, n)

    return data


def train_and_evaluate():
    """Train once and return the model with evaluation metrics."""

    data = generate_synthetic_shipments()

    x = pd.DataFrame({name: data[name] for name in FEATURES})
    y = np.asarray(data["delayed"])

    split_at = int(len(y) * 0.8)

    x_train = x.iloc[:split_at]
    x_test = x.iloc[split_at:]
    y_train = y[:split_at]
    y_test = y[split_at:]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                FEATURES,
            )
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )

    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    matrix = confusion_matrix(y_test, predictions, labels=[0, 1])

    metrics = {
        "model_version": MODEL_VERSION,
        "data_source": "synthetic",
        "training_rows": int(len(y_train)),
        "test_rows": int(len(y_test)),
        "split_method": "chronological 80/20",
        "positive_class": "delayed",
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision_delayed": round(
            float(precision_score(y_test, predictions, zero_division=0)), 4
        ),
        "recall_delayed": round(
            float(recall_score(y_test, predictions, zero_division=0)), 4
        ),
        "f1_delayed": round(
            float(f1_score(y_test, predictions, zero_division=0)), 4
        ),
        "confusion_matrix": {
            "labels": ["on_time", "delayed"],
            "rows_actual_columns_predicted": matrix.tolist(),
        },
        "classification_report": classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["on_time", "delayed"],
            output_dict=True,
            zero_division=0,
        ),
        "note": (
            "Evaluation uses synthetic labels generated from illustrative rules. "
            "Metrics are not evidence of real-world predictive accuracy."
        ),
    }

    # Release temporary training and evaluation data.
    del data, x, y
    del x_train, x_test, y_train, y_test
    del predictions, matrix
    gc.collect()

    return model, metrics


@lru_cache(maxsize=1)
def get_trained_model():
    """Train and cache the model on its first use."""
    return train_and_evaluate()


def get_evaluation():
    """Return cached model evaluation metrics."""
    _, evaluation = get_trained_model()
    return evaluation


def predict_delay_risk(features):
    """Predict delay probability after validating all input features."""

    missing = [name for name in FEATURES if name not in features]
    if missing:
        raise ValueError(
            "Missing required features: " + ", ".join(missing)
        )

    bounds = {
        "distance_km": (0, 20000),
        "planned_transit_hours": (0, 1000),
        "carrier_delay_rate": (0, 1),
        "weather_severity": (0, 4),
        "traffic_severity": (0, 4),
        "customs_risk": (0, 1),
        "hub_congestion": (0, 4),
    }

    row = {}

    for name in FEATURES:
        try:
            value = float(features[name])
        except (TypeError, ValueError):
            raise ValueError(f"{name} must be numeric") from None

        if not np.isfinite(value):
            raise ValueError(f"{name} must be a finite number")

        minimum, maximum = bounds[name]

        if not minimum <= value <= maximum:
            raise ValueError(
                f"{name} must be between {minimum} and {maximum}"
            )

        row[name] = value

    # Train/load only once, after all validations are complete.
    model, _ = get_trained_model()

    probability = float(
        model.predict_proba(
            pd.DataFrame([row], columns=FEATURES)
        )[0, 1]
    )

    if probability >= 0.70:
        risk_level = "high"
    elif probability >= 0.40:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "model_version": MODEL_VERSION,
        "data_source": "synthetic-trained baseline",
        "delay_probability": round(probability, 4),
        "delay_probability_percent": round(probability * 100, 1),
        "predicted_delay": probability >= 0.5,
        "risk_level": risk_level,
        "features_used": row,
        "note": (
            "Prototype prediction trained on synthetic data. "
            "Not validated for real-world operational decisions."
        ),
    }


"""Synthetic shipment delay-risk model for the LogiCopilot hackathon.

This is a prototype trained and evaluated on synthetic data only.
It must not be presented as validated real-world shipment performance.
"""

from datetime import datetime, timedelta, timezone

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
    """Generate reproducible historical-style shipment records."""
    rng = np.random.default_rng(seed)

    dates = [
        datetime(2025, 1, 1, tzinfo=timezone.utc) + timedelta(hours=6 * i)
        for i in range(n)
    ]

    data = {
        "shipment_date": dates,
        "distance_km": rng.integers(30, 2501, n).astype(float),
        "planned_transit_hours": rng.uniform(4, 120, n),
        "carrier_delay_rate": rng.uniform(0.02, 0.55, n),
        "weather_severity": rng.integers(0, 5, n).astype(float),
        "traffic_severity": rng.integers(0, 5, n).astype(float),
        "customs_risk": rng.integers(0, 2, n).astype(float),
        "hub_congestion": rng.integers(0, 5, n).astype(float),
    }

    # A synthetic label-generating process. These coefficients are illustrative,
    # not learned facts about real shipping operations.
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

    # Keep the records in chronological order for the holdout split.
    return data



def train_and_evaluate():
    data = generate_synthetic_shipments()
    split_at = int(len(data["delayed"]) * 0.8)

    # scikit-learn expects a 2D table, not a dictionary of arrays.
    x = pd.DataFrame({name: data[name] for name in FEATURES})
    y = np.asarray(data["delayed"])

    x_train, x_test = x.iloc[:split_at], x.iloc[split_at:]
    y_train, y_test = y[:split_at], y[split_at:]

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

    return model, metrics



def predict_delay_risk(features):
    """Predict delay probability from validated numeric feature values."""
    missing = [name for name in FEATURES if name not in features]
    if missing:
        raise ValueError("Missing required features: " + ", ".join(missing))

    row = {}
    for name in FEATURES:
        try:
            value = float(features[name])
        except (TypeError, ValueError):
            raise ValueError(f"{name} must be numeric") from None

        if not np.isfinite(value):
            raise ValueError(f"{name} must be a finite number")

        row[name] = value

    bounds = {
        "distance_km": (0, 20000),
        "planned_transit_hours": (0, 1000),
        "carrier_delay_rate": (0, 1),
        "weather_severity": (0, 4),
        "traffic_severity": (0, 4),
        "customs_risk": (0, 1),
        "hub_congestion": (0, 4),
    }

    for name, (minimum, maximum) in bounds.items():
        if not minimum <= row[name] <= maximum:
            raise ValueError(
                f"{name} must be between {minimum} and {maximum}"
            )

    probability = float(
    MODEL.predict_proba(pd.DataFrame([row], columns=FEATURES))[0, 1]
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
MODEL, EVALUATION = train_and_evaluate()
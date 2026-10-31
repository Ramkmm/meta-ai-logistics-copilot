"""
Delhivery historical trip-duration training pipeline.

Usage:
  python delhivery_real_data.py --input delhivery_data.csv --output-dir artifacts

This dataset contains segment-level rows. The script aggregates to one row per
trip_uuid, uses the maximum cumulative actual_time as the trip-duration target,
and preserves the source-provided training/test split.

Caution:
  OSRM fields are reconstructed as the maximum values across segments. Confirm
  these route estimates are available at dispatch time before operational use.
  This is historical research data from 2018, not a live feed.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor, ExtraTreesRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


CATEGORICAL_FEATURES = ["route_type", "source_name", "destination_name"]
NUMERIC_FEATURES = ["creation_hour", "creation_weekday", "osrm_time_estimate", "osrm_distance_estimate"]
FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
TARGET = "actual_trip_minutes"


def build_trip_table(raw: pd.DataFrame) -> pd.DataFrame:
    required = {
        "data", "trip_uuid", "route_type", "source_name", "destination_name",
        "trip_creation_time", "actual_time", "osrm_time", "osrm_distance",
    }
    missing = sorted(required - set(raw.columns))
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    raw = raw.copy()
    raw["trip_creation_time"] = pd.to_datetime(raw["trip_creation_time"], errors="coerce")
    for col in ["actual_time", "osrm_time", "osrm_distance"]:
        raw[col] = pd.to_numeric(raw[col], errors="coerce")

    # Keep one consistent source split and route type per trip.
    consistency = raw.groupby("trip_uuid").agg(
        split_count=("data", "nunique"),
        route_count=("route_type", "nunique"),
    )
    bad_ids = consistency[(consistency.split_count != 1) | (consistency.route_count != 1)].index
    if len(bad_ids):
        raw = raw[~raw["trip_uuid"].isin(bad_ids)].copy()

    trips = raw.groupby("trip_uuid", as_index=False).agg(
        data=("data", "first"),
        route_type=("route_type", "first"),
        source_name=("source_name", "first"),
        destination_name=("destination_name", "first"),
        trip_creation_time=("trip_creation_time", "min"),
        actual_trip_minutes=("actual_time", "max"),
        osrm_time_estimate=("osrm_time", "max"),
        osrm_distance_estimate=("osrm_distance", "max"),
        segment_rows=("trip_uuid", "size"),
    )

    trips["creation_hour"] = trips["trip_creation_time"].dt.hour
    trips["creation_weekday"] = trips["trip_creation_time"].dt.day_of_week
    trips = trips.replace([np.inf, -np.inf], np.nan)
    trips = trips.dropna(subset=["data", "actual_trip_minutes", "trip_creation_time"])
    trips = trips[trips["actual_trip_minutes"] > 0].copy()
    return trips


def make_preprocessor() -> ColumnTransformer:
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(
            handle_unknown="ignore",
            min_frequency=2,
            sparse_output=False
        )),
    ])

    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    return ColumnTransformer([
        ("categorical", categorical, CATEGORICAL_FEATURES),
        ("numeric", numeric, NUMERIC_FEATURES),
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to delhivery_data.csv")
    parser.add_argument("--output-dir", default="artifacts")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(input_path, low_memory=False)
    trips = build_trip_table(raw)
    trips.to_csv(output_dir / "delhivery_trip_level.csv", index=False)

    train = trips[trips["data"].astype(str).str.lower() == "training"].copy()
    test = trips[trips["data"].astype(str).str.lower() == "test"].copy()
    if train.empty or test.empty:
        raise ValueError("Expected non-empty 'training' and 'test' groups in the data column.")

    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]

    candidates = {
        "RandomForest": RandomForestRegressor(
            n_estimators=300, min_samples_leaf=2, max_features=0.9,
            n_jobs=-1, random_state=42
        ),
        "ExtraTrees": ExtraTreesRegressor(
            n_estimators=300, min_samples_leaf=2, max_features=0.9,
            n_jobs=-1, random_state=42
        ),
        "HistGradientBoosting": HistGradientBoostingRegressor(
            max_iter=250, learning_rate=0.08, max_leaf_nodes=25,
            l2_regularization=1.0, random_state=42
        ),
    }

    results = {}
    fitted = {}
    for name, estimator in candidates.items():
        model = Pipeline([
            ("preprocessor", make_preprocessor()),
            ("regressor", estimator),
        ])
        model.fit(X_train, y_train)
        pred = np.maximum(0, model.predict(X_test))
        results[name] = {
            "mae_minutes": round(float(mean_absolute_error(y_test, pred)), 3),
            "rmse_minutes": round(float(np.sqrt(mean_squared_error(y_test, pred))), 3),
            "r2": round(float(r2_score(y_test, pred)), 4),
            "test_trips": int(len(y_test)),
        }
        fitted[name] = model

    best_name = min(results, key=lambda name: results[name]["mae_minutes"])
    best_model = fitted[best_name]
    joblib.dump(best_model, output_dir / "delhivery_duration_model.joblib")

    report = {
        "dataset": input_path.name,
        "raw_segment_rows": int(len(raw)),
        "aggregated_trip_rows": int(len(trips)),
        "training_trips": int(len(train)),
        "test_trips": int(len(test)),
        "target": TARGET,
        "target_definition": "maximum actual_time across segment rows for each trip_uuid",
        "features": FEATURES,
        "best_model_by_mae": best_name,
        "model_comparison": results,
        "cautions": [
            "Historical 2018 dataset; not a live shipment feed.",
            "OSRM estimates are aggregated as maximum segment values; verify dispatch-time availability.",
            "Do not use actual_time, actual_distance_to_destination, segment_actual_time, or start_scan_to_end_scan as prediction features.",
            "Metrics are for the provided test split and may not represent current logistics performance.",
        ],
    }
    (output_dir / "evaluation_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, indent=2))
    print(f"\nSaved trip table, model and report under: {output_dir.resolve()}")


if __name__ == "__main__":
    main()

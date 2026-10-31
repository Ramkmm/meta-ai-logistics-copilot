
import os
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from shipment_risk_ml import EVALUATION, predict_delay_risk
from pathlib import Path
from functools import lru_cache

import joblib
import pandas as pd
from fastapi import HTTPException

import json
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen



load_dotenv()

app = FastAPI(
    title="AI Logistics & Supply Chain Copilot",
    version="0.1.0",
    description="Operational insights for Indian distributors and MSMEs",
)
frontend_origin = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173"
).rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list({
        frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

SHIPMENTS = [
    {
        "id": "SHP-1001",
        "destination": "Hyderabad",
        "status": "On time",
        "delay_hours": 0,
        "shipping_cost_inr": 2400,
    },
    {
        "id": "SHP-1002",
        "destination": "Warangal",
        "status": "Delayed",
        "delay_hours": 8,
        "shipping_cost_inr": 3100,
    },
    {
        "id": "SHP-1003",
        "destination": "Vijayawada",
        "status": "Delayed",
        "delay_hours": 12,
        "shipping_cost_inr": 4200,
    },
    {
        "id": "SHP-1004",
        "destination": "Khammam",
        "status": "On time",
        "delay_hours": 0,
        "shipping_cost_inr": 1800,
    },
    {
        "id": "SHP-1005",
        "destination": "Karimnagar",
        "status": "Delayed",
        "delay_hours": 5,
        "shipping_cost_inr": 2700,
    },
]

INVENTORY = [
    {"item": "Cooking oil", "stock": 12, "reorder_level": 20},
    {"item": "Detergent", "stock": 8, "reorder_level": 15},
    {"item": "Rice bags", "stock": 75, "reorder_level": 30},
]


class AnalysisRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    route_context: dict | None = None


def calculate_metrics():
    total = len(SHIPMENTS)
    delayed = sum(s["status"] == "Delayed" for s in SHIPMENTS)
    shipping_cost = sum(s["shipping_cost_inr"] for s in SHIPMENTS)

    return {
        "total_shipments": total,
        "delayed_shipments": delayed,
        "on_time_shipments": total - delayed,
        "on_time_rate_percent": round((total - delayed) / total * 100, 1),
        "total_shipping_cost_inr": shipping_cost,
        "inventory_alerts": sum(
            item["stock"] < item["reorder_level"]
            for item in INVENTORY
        ),
    }
class ShipmentRiskRequest(BaseModel):
    distance_km: float = Field(gt=0, le=20000)
    planned_transit_hours: float = Field(gt=0, le=1000)
    carrier_delay_rate: float = Field(ge=0, le=1)
    weather_severity: int = Field(ge=0, le=5)
    traffic_severity: int = Field(ge=0, le=5)
    customs_risk: int = Field(ge=0, le=1)
    hub_congestion: int = Field(ge=0, le=5)

class DelhiveryDurationRequest(BaseModel):
    route_type: str = Field(min_length=1, max_length=50)
    source_name: str = Field(min_length=1, max_length=150)
    destination_name: str = Field(min_length=1, max_length=150)

    creation_hour: int = Field(ge=0, le=23)
    creation_weekday: int = Field(ge=0, le=6)

    osrm_time_estimate: float = Field(gt=0, le=100000)
    osrm_distance_estimate: float = Field(gt=0, le=100000)
DELHIVERY_MODEL_PATH = (
    Path(__file__).resolve().parent
    / "artifacts"
    / "delhivery_duration_model_compressed.joblib"
)

class RouteEstimateRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=150)
    destination: str = Field(min_length=2, max_length=150)

    vehicle_type: str = Field(default="car")
    shipment_weight_kg: float = Field(ge=0, le=50000)
    package_count: int = Field(default=1, ge=1, le=10000)

    rate_per_km_inr: float = Field(default=0, ge=0)
    handling_per_kg_inr: float = Field(default=0, ge=0)
    fixed_charges_inr: float = Field(default=0, ge=0)

    shipment_value_inr: float = Field(default=0, ge=0)
    insurance_percent: float = Field(default=0, ge=0, le=100)
@lru_cache(maxsize=1)
def load_delhivery_model():
    if not DELHIVERY_MODEL_PATH.exists():
        raise FileNotFoundError("Delhivery model artifact not found.")

    return joblib.load(DELHIVERY_MODEL_PATH)

@lru_cache(maxsize=200)
def geocode_location(place: str):
    """Convert a place name into latitude and longitude."""

    params = urlencode({
        "q": f"{place}, India",
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": "in"
    })

    url = f"https://nominatim.openstreetmap.org/search?{params}"

    request = Request(
        url,
        headers={
            "User-Agent": "BharatAICopilot-LogisticsPrototype/1.0"
        }
    )

    try:
        with urlopen(request, timeout=20) as response:
            results = json.loads(response.read().decode("utf-8"))

        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"Location not found: {place}"
            )

        result = results[0]

        return {
            "latitude": float(result["lat"]),
            "longitude": float(result["lon"]),
            "display_name": result["display_name"]
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("Geocoding error:", type(exc).__name__, str(exc))
        raise HTTPException(
            status_code=502,
            detail="Location lookup service is unavailable."
        )


def calculate_road_route(origin, destination):
    """Calculate a road route using the OSRM public demo service."""

    coordinates = (
        f'{origin["longitude"]},{origin["latitude"]};'
        f'{destination["longitude"]},{destination["latitude"]}'
    )

    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{coordinates}?overview=false"
    )

    request = Request(
        url,
        headers={
            "User-Agent": "BharatAICopilot-LogisticsPrototype/1.0"
        }
    )

    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))

        if result.get("code") != "Ok" or not result.get("routes"):
            raise HTTPException(
                status_code=404,
                detail="No road route found for these locations."
            )

        route = result["routes"][0]

        return {
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_minutes": round(route["duration"] / 60, 2)
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("OSRM routing error:", type(exc).__name__, str(exc))
        raise HTTPException(
            status_code=502,
            detail="Road routing service is unavailable."
        )
@app.post("/route/estimate")
def estimate_road_route(request: RouteEstimateRequest):

    vehicle = request.vehicle_type.strip().lower()

    allowed_vehicles = ["car", "light_truck", "truck"]

    if vehicle not in allowed_vehicles:
        raise HTTPException(
            status_code=400,
            detail="Vehicle must be car, light_truck, or truck."
        )

    # Look up origin and destination.
    origin = geocode_location(request.origin)

    # Respect the public Nominatim one-request-per-second policy.
    time.sleep(1)

    destination = geocode_location(request.destination)

    # Calculate road distance and driving duration.
    route = calculate_road_route(origin, destination)

    distance = route["distance_km"]
    weight = request.shipment_weight_kg

    transport_cost = distance * request.rate_per_km_inr
    handling_cost = weight * request.handling_per_kg_inr

    insurance_cost = (
        request.shipment_value_inr
        * request.insurance_percent / 100
    )

    total_cost = (
        transport_cost
        + handling_cost
        + request.fixed_charges_inr
        + insurance_cost
    )

    cost_per_kg = (
        total_cost / weight if weight > 0 else None
    )

    return {
        "status": "success",
        "route_type": "road",
        "origin": {
            "name": request.origin,
            **origin
        },
        "destination": {
            "name": request.destination,
            **destination
        },
        "vehicle_type": vehicle,
        "shipment": {
            "weight_kg": weight,
            "package_count": request.package_count
        },
        "route": {
            "distance_km": distance,
            "estimated_driving_minutes": route["duration_minutes"],
            "estimated_driving_hours": round(
                route["duration_minutes"] / 60, 2
            )
        },
        "cost_breakdown_inr": {
            "transport": round(transport_cost, 2),
            "handling": round(handling_cost, 2),
            "fixed_charges": round(request.fixed_charges_inr, 2),
            "insurance": round(insurance_cost, 2),
            "total": round(total_cost, 2),
            "cost_per_kg": (
                round(cost_per_kg, 2)
                if cost_per_kg is not None else None
            )
        },
        "provider": {
            "geocoding": "OpenStreetMap Nominatim",
            "routing": "OSRM"
        },
        "limitations": [
            "Indicative road route, not a live traffic ETA.",
            "Vehicle type does not yet enforce truck road restrictions.",
            "Freight costs use rates supplied by the user.",
            "Not a carrier quotation or guaranteed delivery commitment."
        ]
    }


@app.get("/")
def home():
    return {
        "app": "AI Logistics & Supply Chain Copilot",
        "status": "running",
        "mode": "sample-data",
    }


@app.get("/dashboard")
def dashboard():
    return {
        "metrics": calculate_metrics(),
        "shipments": SHIPMENTS,
        "inventory": INVENTORY,
    }

@app.get("/shipment-risk/evaluation")
def shipment_risk_evaluation():
    return EVALUATION


@app.post("/shipment-risk/predict")
def shipment_risk_predict(request: ShipmentRiskRequest):
    features = request.model_dump()
    return predict_delay_risk(features)

@app.get("/real-data/evaluation")
def delhivery_model_evaluation():
    report_path = (
        Path(__file__).resolve().parent
        / "artifacts"
        / "evaluation_report.json"
    )

    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Model evaluation report not found."
        )

    import json

    with open(report_path, "r", encoding="utf-8") as file:
        return json.load(file)


@app.post("/real-data/predict-duration")
def predict_delhivery_duration(request: DelhiveryDurationRequest):
    try:
        model = load_delhivery_model()

        features = pd.DataFrame([request.model_dump()])

        predicted_minutes = float(model.predict(features)[0])
        predicted_minutes = max(0.0, predicted_minutes)

        return {
            "status": "success",
            "model": "ExtraTrees",
            "model_version": "delhivery-historical-2018-v1",
            "predicted_duration_minutes": round(predicted_minutes, 2),
            "predicted_duration_hours": round(
                predicted_minutes / 60, 2
            ),
            "note": (
                "Experimental prediction based on historical "
                "Delhivery trip data from 2018. Not a verified "
                "live shipment ETA."
            ),
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Delhivery prediction model is not available."
        )

    except Exception as exc:
        print(
            "Delhivery prediction error:",
            type(exc).__name__,
            str(exc)
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to generate trip-duration prediction."
        )

@app.post("/analyze")
def analyze(request: AnalysisRequest):
    raw_api_key = os.getenv("MODEL_API_KEY", "")
    api_key = raw_api_key.strip()

    print("Meta API key configured:", bool(api_key))
    print("Meta API key length:", len(api_key))
    print(
          "Meta API key has surrounding whitespace:",
    raw_api_key != raw_api_key.strip()
    )

    if not api_key:
        return {
            "mode": "local-rules",
            "question": request.question,
            "metrics": calculate_metrics(),
            "findings": [
                "Meta Model API key is not configured.",
                "The dashboard data is available for local analysis.",
            ],
            "recommendations": [
                "Configure MODEL_API_KEY in your local .env file.",
                "Restart the backend and retry the analysis.",
            ],
            "note": "Meta AI analysis is currently unavailable.",
        }

    delayed_shipments = [
        shipment for shipment in SHIPMENTS
        if shipment["status"] == "Delayed"
    ]

    low_stock = [
        item for item in INVENTORY
        if item["stock"] < item["reorder_level"]
    ]

    business_data = {
        "metrics": calculate_metrics(),
        "shipments": SHIPMENTS,
        "inventory": INVENTORY,
        "delayed_shipments": delayed_shipments,
        "low_stock_items": low_stock,
    }

    prompt = f"""
You are an AI Logistics and Supply Chain Copilot
for Indian distributors and MSMEs.

Analyze the following business data and answer the user's question.

BUSINESS DATA:
{business_data}

SELECTED ROAD ROUTE AND CARGO ESTIMATE:
{json.dumps(request.route_context, indent=2) if request.route_context else "No route estimate was supplied."}

USER QUESTION:
{request.question}

Instructions:
1. Use only the supplied data for factual claims.
2. Analyze the selected route, vehicle, cargo weight and cost when supplied.
3. Comment on estimated distance and driving duration.
4. Evaluate the cost breakdown and cost per kg.
5. Suggest practical transport cost or operational improvements.
6. Prioritize urgent shipment delays and inventory shortages.
7. Use INR for monetary values.
8. Clearly distinguish observed facts from assumptions.
9. Do not invent live traffic, truck restrictions, carrier quotes or delivery commitments.
10. Mention that road duration is an indicative routing estimate, not a guaranteed delivery time.
11. Give three practical, prioritized recommendations.
12. Mention that existing dashboard shipment and inventory records are sample data.
13. Format the answer with clear headings and concise bullet points.
"""

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.meta.ai/v1",
        )

        response = client.responses.create(
            model="muse-spark-1.3",
            input=[
                {
                    "role": "developer",
                    "content": (
                        "You are a careful, data-aware logistics "
                        "decision-support assistant for Indian MSMEs."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        )

        answer = response.output_text

        if not answer:
            raise ValueError("Meta Model API returned an empty response.")

        return {
            "mode": "meta-api",
            "question": request.question,
            "metrics": calculate_metrics(),
            "findings": [
                f"{len(delayed_shipments)} of {len(SHIPMENTS)} "
                "sample shipments are delayed.",
                f"{len(low_stock)} inventory items are below reorder level.",
            ],
            "recommendations": [],
            "message": answer,
            "note": "AI-generated analysis based on sample business data.",
        }


    except Exception as exc:
        print(
            f"Meta API analysis error: {type(exc).__name__}: {exc}"
        )
        print("Meta API request ID:", getattr(exc, "request_id", None))
        print("Meta API status code:", getattr(exc, "status_code", None))

        # Temporary diagnostics for the Meta support investigation.
        try:
            diagnostic_models = client.models.list()
            model_ids = {item.id for item in diagnostic_models.data}
            print("Meta API models available on Render:", sorted(model_ids))
            print(
                "Meta API diagnostic: "
                f"muse_spark_1_3_available="
                f"{'muse-spark-1.3' in model_ids}"
            )
        except Exception as diagnostic_exc:
            print(
                "Meta API diagnostic failed: "
                f"{type(diagnostic_exc).__name__}: {diagnostic_exc}"
            )

        # Dynamically rank delayed shipments.
        ranked_delays = sorted(
            delayed_shipments,
            key=lambda shipment: shipment["delay_hours"],
            reverse=True,
        )

        findings = [
            "The dashboard data is available for local analysis."
        ]

        if request.route_context:
            route_context = request.route_context

            findings.extend([
                (
                    f"Selected route: "
                    f"{route_context.get('origin', {}).get('name', 'Unknown')} "
                    f"to "
                    f"{route_context.get('destination', {}).get('name', 'Unknown')}."
                ),
                (
                    f"Estimated distance: "
                    f"{route_context.get('route', {}).get('distance_km', 'N/A')} km."
                ),
                (
                    f"Estimated driving time: "
                    f"{route_context.get('route', {}).get('estimated_driving_hours', 'N/A')} hours."
                ),
                (
                    f"Estimated shipment cost: INR "
                    f"{route_context.get('cost_breakdown_inr', {}).get('total', 'N/A')}."
                )
            ])

        for shipment in ranked_delays:
            findings.append(
                f'{shipment["id"]} to {shipment["destination"]} '
                f'is delayed by {shipment["delay_hours"]} hours.'
            )

        # Calculate inventory shortfalls.
        inventory_shortages = []

        for item in low_stock:
            shortage = item["reorder_level"] - item["stock"]

            inventory_shortages.append({
                "item": item["item"],
                "stock": item["stock"],
                "reorder_level": item["reorder_level"],
                "shortage": shortage,
            })

            findings.append(
                f'{item["item"]}: {shortage} units below reorder level '
                f'(stock {item["stock"]}, reorder level '
                f'{item["reorder_level"]}).'
            )

        # Generate recommendations from current data.
        recommendations = []

        for shipment in ranked_delays:
            delay = shipment["delay_hours"]

            if delay >= 10:
                priority = "HIGH"
            elif delay >= 6:
                priority = "MEDIUM"
            else:
                priority = "LOW"

            recommendations.append(
                f'{priority} priority: Contact the carrier and check '
                f'the status of shipment {shipment["id"]} to '
                f'{shipment["destination"]}, delayed by {delay} hours.'
            )

        for item in inventory_shortages:
            recommendations.append(
                f'Reorder at least {item["shortage"]} units of '
                f'{item["item"]} to reach its reorder level of '
                f'{item["reorder_level"]} units.'
            )

        return {
            "mode": "local-rules",
            "question": request.question,
            "metrics": calculate_metrics(),
            "findings": findings,
            "recommendations": recommendations,
            "inventory_shortages": inventory_shortages,
            "message": (
                "Rule-based analysis is being shown because Meta AI is "
                "temporarily unavailable. Recommendations are calculated "
                "from the current sample logistics data, not a live AI response."
            ),
             "note": "Local fallback mode. Route details are included when supplied, but Meta AI is unavailable.",
        }

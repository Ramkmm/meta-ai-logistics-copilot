
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


load_dotenv()

app = FastAPI(
    title="AI Logistics & Supply Chain Copilot",
    version="0.1.0",
    description="Operational insights for Indian distributors and MSMEs",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


@app.post("/analyze")
def analyze(request: AnalysisRequest):
    metrics = calculate_metrics()
    delayed_shipments = [
        s for s in SHIPMENTS if s["status"] == "Delayed"
    ]
    low_stock = [
        item for item in INVENTORY
        if item["stock"] < item["reorder_level"]
    ]

    api_key = os.getenv("MODEL_API_KEY")

    if not api_key:
        return {
            "mode": "local-rules",
            "question": request.question,
            "metrics": metrics,
            "findings": [
                f"{len(delayed_shipments)} of {len(SHIPMENTS)} shipments are delayed.",
                f"On-time delivery rate is {metrics['on_time_rate_percent']}%.",
                f"{len(low_stock)} inventory items are below reorder level.",
            ],
            "recommendations": [
                "Prioritize the shipment with the longest delay.",
                "Review delay causes with the relevant transport providers.",
                "Review replenishment for: "
                + ", ".join(item["item"] for item in low_stock),
            ],
            "note": "Sample data; Meta AI integration is not active.",
        }

    # The Meta API call will be added after billing access is confirmed.
    return {
        "mode": "meta-pending",
        "question": request.question,
        "metrics": metrics,
        "message": (
            "The API key is configured. Meta AI analysis will be "
            "enabled after billing and credit access are verified."
        ),
    }

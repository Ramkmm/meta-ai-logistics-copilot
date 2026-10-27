
import os
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


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
    api_key = os.getenv("MODEL_API_KEY")

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

USER QUESTION:
{request.question}

Instructions:
1. Use only the supplied data for factual claims.
2. Prioritize urgent shipment delays and inventory shortages.
3. Use INR for monetary values.
4. Clearly distinguish observed facts from possible causes.
5. Give three practical, prioritized recommendations.
6. Do not invent routes, costs, inventory figures, or business events.
7. Mention that this is sample data when relevant.
8. Format the answer with clear headings and concise bullet points.
"""

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.meta.ai/v1",
        )

        response = client.chat.completions.create(
            model="muse-spark-1.3",
            messages=[
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

        answer = response.choices[0].message.content

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
        print(f"Meta API analysis error: {type(exc).__name__}: {exc}")
        from fastapi import HTTPException

        raise HTTPException(
            status_code=502,
            detail=(
                "Meta AI analysis failed. Check API access, credits, "
                "model availability, and the backend terminal."
            ),
        )


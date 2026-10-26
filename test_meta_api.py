
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("MODEL_API_KEY")
if not api_key:
    raise RuntimeError(
        "MODEL_API_KEY is missing. Check your local .env file."
    )

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
                "You are an AI Logistics and Supply Chain Copilot "
                "for Indian businesses. Give practical, data-aware "
                "recommendations."
            ),
        },
        {
            "role": "user",
            "content": (
                "An Indian distributor has five late deliveries, "
                "two stock shortages, and rising fuel costs. "
                "Identify the priorities and recommend three actions."
            ),
        },
    ],
)

print("\n=== Bharat AI Logistics Copilot ===\n")
print(response.choices[0].message.content)
print("\n=== Meta API test completed ===")

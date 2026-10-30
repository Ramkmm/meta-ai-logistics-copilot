
import json

from shipment_risk_ml import EVALUATION, predict_delay_risk

print("=== Synthetic model evaluation ===")
print(json.dumps(EVALUATION, indent=2))

print("\n=== Example shipment prediction ===")
example = {
    "distance_km": 850,
    "planned_transit_hours": 36,
    "carrier_delay_rate": 0.30,
    "weather_severity": 3,
    "traffic_severity": 2,
    "customs_risk": 0,
    "hub_congestion": 3,
}

print(json.dumps(predict_delay_risk(example), indent=2))

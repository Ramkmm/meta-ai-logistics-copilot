import { useEffect, useState } from "react";
import { Activity, BrainCircuit, LoaderCircle, ShieldAlert } from "lucide-react";
import "./MLShipmentRisk.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const initialFeatures = {
  distance_km: 850,
  planned_transit_hours: 36,
  carrier_delay_rate: 0.3,
  weather_severity: 3,
  traffic_severity: 2,
  customs_risk: 0,
  hub_congestion: 3,
};

const fields = [
  { name: "distance_km", label: "Distance (km)", min: 1, max: 20000, step: 1 },
  { name: "planned_transit_hours", label: "Planned transit (hours)", min: 0.1, max: 1000, step: 0.1 },
  { name: "carrier_delay_rate", label: "Carrier delay rate (0–1)", min: 0, max: 1, step: 0.01 },
  { name: "weather_severity", label: "Weather severity (0–5)", min: 0, max: 5, step: 1 },
  { name: "traffic_severity", label: "Traffic severity (0–5)", min: 0, max: 5, step: 1 },
  { name: "customs_risk", label: "Customs risk (0 or 1)", min: 0, max: 1, step: 1 },
  { name: "hub_congestion", label: "Hub congestion (0–5)", min: 0, max: 5, step: 1 },
];

function Metric({ label, value }) {
  return (
    <div className="ml-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MLShipmentRisk() {
  const [features, setFeatures] = useState(initialFeatures);
  const [evaluation, setEvaluation] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [predictionError, setPredictionError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`${API}/shipment-risk/evaluation`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load model evaluation.");
        return response.json();
      })
      .then((data) => {
        if (active) setEvaluation(data);
      })
      .catch((error) => {
        if (active) setEvaluationError(error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  function updateFeature(event) {
    const { name, value } = event.target;
    setFeatures((previous) => ({
      ...previous,
      [name]: value === "" ? "" : Number(value),
    }));
  }

  async function runPrediction(event) {
    event.preventDefault();
    setLoading(true);
    setPrediction(null);
    setPredictionError("");

    try {
      const response = await fetch(`${API}/shipment-risk/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(features),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg).join(", ")
          : data.detail;
        throw new Error(detail || "Prediction request failed.");
      }

      setPrediction(data);
    } catch (error) {
      setPredictionError(error.message || "Unable to generate prediction.");
    } finally {
      setLoading(false);
    }
  }

  const riskClass = prediction?.risk_level?.toLowerCase() || "";
  const probability =
    prediction?.delay_probability_percent ??
    (prediction?.delay_probability != null
      ? prediction.delay_probability * 100
      : null);

  return (
    <section className="panel ml-risk-panel" id="ml-shipment-risk">
      <div className="panel-heading">
        <div>
          <h2>ML Shipment Risk Prediction</h2>
          <p>Estimate delay probability from shipment operating conditions</p>
        </div>
        <span className="tag">MACHINE LEARNING</span>
      </div>

      <div className="ml-model-info">
        <BrainCircuit size={18} />
        <span>
          Model: {evaluation?.model_version || "Loading model information…"}
        </span>
        <span className="ml-data-label">Synthetic training data</span>
      </div>

      <form className="ml-prediction-form" onSubmit={runPrediction}>
        <div className="ml-input-grid">
          {fields.map((field) => (
            <label className="ml-input-field" key={field.name}>
              <span>{field.label}</span>
              <input
                type="number"
                name={field.name}
                min={field.min}
                max={field.max}
                step={field.step}
                value={features[field.name]}
                onChange={updateFeature}
                required
              />
            </label>
          ))}
        </div>

        <button className="ml-predict-button" type="submit" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle size={16} className="ml-spinner" />
              Predicting…
            </>
          ) : (
            <>
              <Activity size={16} />
              Predict shipment risk
            </>
          )}
        </button>
      </form>

      {predictionError && (
        <div className="ml-error" role="alert">
          {predictionError}
        </div>
      )}

      {prediction && (
        <div className="ml-result">
          <div className="ml-result-heading">
            <div>
              <h3>Prediction result</h3>
              <p>{prediction.model_version}</p>
            </div>
            <span className={`ml-risk-label ${riskClass}`}>
              {prediction.risk_level} risk
            </span>
          </div>

          <div className="ml-probability">
            <strong>
              {probability == null ? "—" : `${Number(probability).toFixed(1)}%`}
            </strong>
            <span>Estimated delay probability</span>
          </div>

          <div className="ml-probability-track">
            <div
              className={`ml-probability-fill ${riskClass}`}
              style={{
                width: `${Math.min(100, Math.max(0, Number(probability) || 0))}%`,
              }}
            />
          </div>

          <p className="ml-predicted-status">
            Predicted outcome:{" "}
            <strong>
              {prediction.predicted_delay ? "Potential delay" : "No delay predicted"}
            </strong>
          </p>

          <p className="ml-disclaimer">
            {prediction.note}
          </p>
        </div>
      )}

      <div className="ml-evaluation">
        <div className="ml-evaluation-heading">
          <ShieldAlert size={17} />
          <strong>Model evaluation</strong>
        </div>

        {evaluation ? (
          <>
            <div className="ml-metrics-grid">
              <Metric label="Accuracy" value={`${(evaluation.accuracy * 100).toFixed(1)}%`} />
              <Metric label="Precision" value={`${(evaluation.precision_delayed * 100).toFixed(1)}%`} />
              <Metric label="Recall" value={`${(evaluation.recall_delayed * 100).toFixed(1)}%`} />
              <Metric label="F1 score" value={`${(evaluation.f1_delayed * 100).toFixed(1)}%`} />
            </div>
            <p className="ml-disclaimer">
              Evaluated on {evaluation.test_rows} synthetic test records using a{" "}
              {evaluation.split_method} split. These metrics are not evidence of
              real-world predictive accuracy.
            </p>
          </>
        ) : (
          <p className="ml-disclaimer">
            {evaluationError || "Loading evaluation metrics…"}
          </p>
        )}
      </div>
    </section>
  );
}
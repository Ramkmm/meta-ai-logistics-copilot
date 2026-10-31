
import { useState } from "react";
import {
  BrainCircuit,
  Clock3,
  LoaderCircle,
  MapPin,
  Route,
  Truck,
} from "lucide-react";
import "./DelhiveryDuration.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const initialFeatures = {
  route_type: "FTL",
  source_name: "Mumbai",
  destination_name: "Hyderabad",
  creation_hour: 10,
  creation_weekday: 2,
  osrm_time_estimate: 600,
  osrm_distance_estimate: 700,
};

export default function DelhiveryDuration() {
  const [features, setFeatures] = useState(initialFeatures);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value, type } = event.target;
    setFeatures((previous) => ({
      ...previous,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  }

  async function predictDuration(event) {
    event.preventDefault();
    setLoading(true);
    setPrediction(null);
    setError("");

    try {
      const response = await fetch(`${API}/real-data/predict-duration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(features),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg).join(", ")
          : data.detail;
        throw new Error(detail || "Duration prediction failed.");
      }

      setPrediction(data);
    } catch (err) {
      setError(err.message || "Unable to connect to the prediction API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel delhivery-panel" id="delhivery-duration">
      <div className="panel-heading">
        <div>
          <h2>Historical ML Trip Duration Predictor</h2>
          <p>Estimate trip duration using the Delhivery historical dataset</p>
        </div>
        <span className="tag">REAL-DATA ML</span>
      </div>

      <div className="delhivery-model-info">
        <BrainCircuit size={19} />
        <span>ExtraTrees Regression Model</span>
        <span className="delhivery-data-label">2018 historical data</span>
      </div>

      <form onSubmit={predictDuration}>
        <div className="delhivery-input-grid">
          <label>
            Route type
            <select
              name="route_type"
              value={features.route_type}
              onChange={updateField}
              required
            >
              <option value="FTL">FTL</option>
              <option value="Carting">Carting</option>
            </select>
          </label>

          <label>
            Source location
            <input
              name="source_name"
              value={features.source_name}
              onChange={updateField}
              maxLength={150}
              required
            />
          </label>

          <label>
            Destination location
            <input
              name="destination_name"
              value={features.destination_name}
              onChange={updateField}
              maxLength={150}
              required
            />
          </label>

          <label>
            Creation hour (0–23)
            <input
              type="number"
              name="creation_hour"
              min="0"
              max="23"
              value={features.creation_hour}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Weekday (Monday = 0)
            <input
              type="number"
              name="creation_weekday"
              min="0"
              max="6"
              value={features.creation_weekday}
              onChange={updateField}
              required
            />
          </label>

          <label>
            OSRM estimated time (minutes)
            <input
              type="number"
              name="osrm_time_estimate"
              min="0.01"
              step="any"
              value={features.osrm_time_estimate}
              onChange={updateField}
              required
            />
          </label>

          <label>
            OSRM estimated distance
            <input
              type="number"
              name="osrm_distance_estimate"
              min="0.01"
              step="any"
              value={features.osrm_distance_estimate}
              onChange={updateField}
              required
            />
          </label>
        </div>

        <p className="delhivery-field-note">
          OSRM distance uses the dataset's original units. Confirm the
          estimates are available at dispatch time before operational use.
        </p>

        <button
          className="delhivery-predict-button"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <LoaderCircle className="delhivery-spinner" size={17} />
              Predicting duration...
            </>
          ) : (
            <>
              <Clock3 size={17} />
              Predict trip duration
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="delhivery-error" role="alert">
          {error}
        </div>
      )}

      {prediction && (
        <div className="delhivery-result">
          <div className="delhivery-result-heading">
            <div>
              <h3>Predicted trip duration</h3>
              <p>{prediction.model_version}</p>
            </div>
            <Truck size={24} />
          </div>

          <div className="delhivery-duration-value">
            {Number(prediction.predicted_duration_hours).toFixed(2)}
            <span>hours</span>
          </div>

          <p className="delhivery-minutes">
            {Number(prediction.predicted_duration_minutes).toLocaleString(
              "en-IN",
              { maximumFractionDigits: 2 }
            )}{" "}
            minutes
          </p>

          <div className="delhivery-route-summary">
            <MapPin size={16} />
            {features.source_name} → {features.destination_name}
            <Route size={16} />
            {features.route_type}
          </div>

          <p className="delhivery-disclaimer">
            {prediction.note}
          </p>
        </div>
      )}

      <p className="delhivery-disclaimer">
        Experimental research model. Historical 2018 performance does not
        establish current route accuracy or a guaranteed delivery ETA.
      </p>
    </section>
  );
}

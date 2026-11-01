
import { useState } from "react";
import {
  BrainCircuit,
  Clock3,
} from "lucide-react";
import "./DelhiveryDuration.css";

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

  function updateField(event) {
    const { name, value, type } = event.target;

    setFeatures((previous) => ({
      ...previous,
      [name]: type === "number"
        ? (value === "" ? "" : Number(value))
        : value,
    }));
  }

  return (
    <section
      className="panel delhivery-panel"
      id="delhivery-duration"
    >
      <div className="panel-heading">
        <div>
          <h2>Historical ML Trip Duration Predictor</h2>
          <p>
            Estimate trip duration using the Delhivery historical dataset
          </p>
        </div>
        <span className="tag">REAL-DATA ML</span>
      </div>

      <div className="delhivery-model-info">
        <BrainCircuit size={19} />
        <span>ExtraTrees Regression Model</span>
        <span className="delhivery-data-label">
          2018 historical data
        </span>
      </div>

      <div className="delhivery-input-grid">
        <label>
          Route type
          <select
            name="route_type"
            value={features.route_type}
            onChange={updateField}
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
          />
        </label>

        <label>
          Destination location
          <input
            name="destination_name"
            value={features.destination_name}
            onChange={updateField}
            maxLength={150}
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
          />
        </label>
      </div>

      <p className="delhivery-field-note">
        OSRM distance uses the dataset's original units. Confirm the
        estimates are available at dispatch time before operational use.
      </p>

      <button
        className="delhivery-predict-button"
        type="button"
        disabled
        title="Temporarily disabled to protect API memory"
      >
        <Clock3 size={17} />
        Prediction temporarily disabled
      </button>

      <div className="delhivery-memory-notice" role="note">
        <strong>Why is prediction temporarily disabled?</strong>

        <p>
          The historical ExtraTrees ML model requires significant
          memory during model loading and prediction. To prevent the
          Render API from exceeding its 512 MB memory limit and
          restarting, this prediction service has been temporarily
          disabled.
        </p>

        <p>
          The historical 2018 dataset, trained model and research work
          are retained for future memory optimization and deployment.
        </p>
      </div>

      <p className="delhivery-disclaimer">
        Experimental research model. Historical 2018 performance does
        not establish current route accuracy or a guaranteed delivery ETA.
      </p>
    </section>
  );
}

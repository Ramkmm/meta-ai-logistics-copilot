
import { useState } from "react";
import { MapPin, Truck, Package, Route, Clock3, IndianRupee } from "lucide-react";
import "./RouteEstimator.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export default function RouteEstimator({ onRouteEstimated }) {
  const [form, setForm] = useState({
    origin: "Vijayawada",
    destination: "Khammam",
    vehicle_type: "truck",
    shipment_weight_kg: 5000,
    package_count: 100,
    rate_per_km_inr: 35,
    handling_per_kg_inr: 0.5,
    fixed_charges_inr: 500,
    shipment_value_inr: 200000,
    insurance_percent: 0.2,
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function estimateRoute(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
if (onRouteEstimated) {
  onRouteEstimated(null);
}

    try {
      const payload = {
        ...form,
        shipment_weight_kg: Number(form.shipment_weight_kg),
        package_count: Number(form.package_count),
        rate_per_km_inr: Number(form.rate_per_km_inr),
        handling_per_kg_inr: Number(form.handling_per_kg_inr),
        fixed_charges_inr: Number(form.fixed_charges_inr),
        shipment_value_inr: Number(form.shipment_value_inr),
        insurance_percent: Number(form.insurance_percent),
      };

      const response = await fetch(`${API}/route/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to estimate this route."
        );
      }


      setResult(data);

      if (onRouteEstimated) {
        onRouteEstimated({
          ...data,
          vehicle_type: payload.vehicle_type,
          shipment: {
            weight_kg: payload.shipment_weight_kg,
            package_count: payload.package_count,
            shipment_value_inr: payload.shipment_value_inr,
          },
          pricing_inputs: {
            rate_per_km_inr: payload.rate_per_km_inr,
            handling_per_kg_inr: payload.handling_per_kg_inr,
            fixed_charges_inr: payload.fixed_charges_inr,
            insurance_percent: payload.insurance_percent,
          },
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to estimate this route."
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <section className="panel route-estimator" id="route-estimator">
      <div className="route-heading">
        <div>
          <span className="route-eyebrow">ROAD LOGISTICS</span>
          <h2>Road Cargo Route & Cost Estimator</h2>
          <p>Estimate road distance, driving duration and shipment cost.</p>
        </div>
        <div className="route-main-icon">
          <Truck size={25} />
        </div>
      </div>

      <form onSubmit={estimateRoute}>
        <div className="route-form-grid">
          <label>
            Origin
            <div className="route-input-icon">
              <MapPin size={17} />
              <input
                name="origin"
                value={form.origin}
                onChange={updateField}
                placeholder="e.g. Hyderabad"
                required
                minLength={2}
              />
            </div>
          </label>

          <label>
            Destination
            <div className="route-input-icon">
              <MapPin size={17} />
              <input
                name="destination"
                value={form.destination}
                onChange={updateField}
                placeholder="e.g. Warangal"
                required
                minLength={2}
              />
            </div>
          </label>

          <label>
            Vehicle type
            <select
              name="vehicle_type"
              value={form.vehicle_type}
              onChange={updateField}
            >
              <option value="car">Car</option>
              <option value="light_truck">Light commercial vehicle</option>
              <option value="truck">Truck</option>
            </select>
          </label>

          <label>
            Shipment weight (kg)
            <input
              type="number"
              name="shipment_weight_kg"
              value={form.shipment_weight_kg}
              onChange={updateField}
              min="0"
              max="50000"
              step="0.1"
              required
            />
          </label>

          <label>
            Number of packages
            <input
              type="number"
              name="package_count"
              value={form.package_count}
              onChange={updateField}
              min="1"
              max="10000"
              required
            />
          </label>

          <label>
            Transport rate (₹ / km)
            <input
              type="number"
              name="rate_per_km_inr"
              value={form.rate_per_km_inr}
              onChange={updateField}
              min="0"
              step="0.01"
            />
          </label>

          <label>
            Handling rate (₹ / kg)
            <input
              type="number"
              name="handling_per_kg_inr"
              value={form.handling_per_kg_inr}
              onChange={updateField}
              min="0"
              step="0.01"
            />
          </label>

          <label>
            Fixed charges (₹)
            <input
              type="number"
              name="fixed_charges_inr"
              value={form.fixed_charges_inr}
              onChange={updateField}
              min="0"
              step="0.01"
            />
          </label>

          <label>
            Shipment value (₹)
            <input
              type="number"
              name="shipment_value_inr"
              value={form.shipment_value_inr}
              onChange={updateField}
              min="0"
              step="0.01"
            />
          </label>

          <label>
            Insurance (%)
            <input
              type="number"
              name="insurance_percent"
              value={form.insurance_percent}
              onChange={updateField}
              min="0"
              max="100"
              step="0.01"
            />
          </label>
        </div>

        <button className="route-submit" type="submit" disabled={loading}>
          <Route size={17} />
          {loading ? "Calculating route..." : "Estimate route & cost"}
        </button>
      </form>

      {error && <div className="route-error">{error}</div>}

      {result && (
        <div className="route-results">
          <div className="route-result-title">
            <h3>Route estimation results</h3>
            <span>ESTIMATE</span>
          </div>

          <div className="route-location-summary">
            <div>
              <small>ORIGIN</small>
              <strong>{result.origin.name}</strong>
            </div>
            <Route size={22} />
            <div>
              <small>DESTINATION</small>
              <strong>{result.destination.name}</strong>
            </div>
          </div>

          <div className="route-result-grid">
            <article>
              <Route size={19} />
              <small>Road distance</small>
              <strong>{result.route.distance_km.toLocaleString("en-IN")} km</strong>
            </article>

            <article>
              <Clock3 size={19} />
              <small>Estimated driving time</small>
              <strong>{result.route.estimated_driving_hours} hours</strong>
            </article>

            <article>
              <IndianRupee size={19} />
              <small>Estimated total cost</small>
              <strong>{currency(result.cost_breakdown_inr.total)}</strong>
            </article>

            <article>
              <Package size={19} />
              <small>Cost per kg</small>
              <strong>
                {result.cost_breakdown_inr.cost_per_kg == null
                  ? "Not available"
                  : currency(result.cost_breakdown_inr.cost_per_kg)}
              </strong>
            </article>
          </div>

          <h4>Cost breakdown</h4>
          <div className="route-cost-table">
            <div><span>Transport</span><strong>{currency(result.cost_breakdown_inr.transport)}</strong></div>
            <div><span>Handling</span><strong>{currency(result.cost_breakdown_inr.handling)}</strong></div>
            <div><span>Fixed charges</span><strong>{currency(result.cost_breakdown_inr.fixed_charges)}</strong></div>
            <div><span>Insurance</span><strong>{currency(result.cost_breakdown_inr.insurance)}</strong></div>
            <div className="route-cost-total"><span>Total estimated cost</span><strong>{currency(result.cost_breakdown_inr.total)}</strong></div>
          </div>

          <p className="route-provider">
            Geocoding: {result.provider.geocoding} · Routing: {result.provider.routing}
          </p>

          <div className="route-disclaimer">
            <strong>Important limitations</strong>
            <ul>
              {result.limitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}


import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./RiskInsights.css";

const RISK_LEVELS = [
  { name: "On track", color: "#15956b" },
  { name: "Low risk", color: "#60a5fa" },
  { name: "Medium risk", color: "#d97706" },
  { name: "High risk", color: "#dc5b52" },
];

function getRisk(shipment) {
  const delay = Number(shipment.delay_hours) || 0;

  if (shipment.status !== "Delayed" || delay <= 0) {
    return "On track";
  }
  if (delay >= 10) return "High risk";
  if (delay >= 6) return "Medium risk";
  return "Low risk";
}

const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function RiskInsights({ shipments = [] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");

  const enrichedShipments = useMemo(
    () =>
      shipments.map((shipment) => ({
        ...shipment,
        risk: getRisk(shipment),
        delay: Number(shipment.delay_hours) || 0,
      })),
    [shipments]
  );

  const riskData = useMemo(
    () =>
      RISK_LEVELS.map((level) => ({
        name: level.name,
        value: enrichedShipments.filter(
          (shipment) => shipment.risk === level.name
        ).length,
        color: level.color,
      })),
    [enrichedShipments]
  );

  const filteredShipments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedShipments
      .filter((shipment) => {
        const matchesSearch =
          !query ||
          String(shipment.id).toLowerCase().includes(query) ||
          String(shipment.destination).toLowerCase().includes(query);

        const matchesStatus =
          statusFilter === "All" || shipment.status === statusFilter;

        const matchesRisk =
          riskFilter === "All" || shipment.risk === riskFilter;

        return matchesSearch && matchesStatus && matchesRisk;
      })
      .sort((a, b) => b.delay - a.delay);
  }, [enrichedShipments, search, statusFilter, riskFilter]);

  const delayedCount = enrichedShipments.filter(
    (shipment) => shipment.status === "Delayed"
  ).length;

  const highRiskCount = enrichedShipments.filter(
    (shipment) => shipment.risk === "High risk"
  ).length;

  return (
    <section className="panel risk-insights" aria-labelledby="risk-title">
      <div className="panel-heading">
        <div>
          <h2 id="risk-title">Shipment Risk Intelligence</h2>
          <p>Risk categories and delay exposure from sample shipment records</p>
        </div>
        <span className="tag">SYNTHETIC DATA</span>
      </div>

      <div className="risk-summary-grid">
        <article className="risk-summary-card">
          <span>Total shipments</span>
          <strong>{enrichedShipments.length}</strong>
        </article>
        <article className="risk-summary-card">
          <span>Delayed</span>
          <strong className="risk-number-warning">{delayedCount}</strong>
        </article>
        <article className="risk-summary-card">
          <span>High risk</span>
          <strong className="risk-number-critical">{highRiskCount}</strong>
        </article>
      </div>

      <div className="risk-charts-grid">
        <div className="risk-chart-block">
          <h3>Risk distribution</h3>
          <p>Shipment count by rule-based risk category</p>
          <div className="risk-pie-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="48%"
                  innerRadius={52}
                  outerRadius={83}
                  paddingAngle={3}
                >
                  {riskData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} shipment(s)`, "Count"]} />
                <Legend verticalAlign="bottom" height={42} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="risk-chart-block">
          <h3>Delay exposure</h3>
          <p>Hours delayed, highest first</p>
          <div className="risk-bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...enrichedShipments]
                  .sort((a, b) => b.delay - a.delay)
                  .slice(0, 8)}
                margin={{ top: 8, right: 8, left: -18, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="id"
                  tickFormatter={(id) => String(id).replace("SHP-", "")}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [`${value} hours`, "Delay"]}
                  labelFormatter={(id) => `Shipment ${id}`}
                />
                <Bar dataKey="delay" name="Delay hours" radius={[5, 5, 0, 0]}>
                  {[...enrichedShipments]
                    .sort((a, b) => b.delay - a.delay)
                    .slice(0, 8)
                    .map((shipment) => {
                      const color =
                        RISK_LEVELS.find(
                          (level) => level.name === shipment.risk
                        )?.color ?? "#5267e8";

                      return <Cell key={shipment.id} fill={color} />;
                    })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="risk-table-heading">
        <div>
          <h3>Find a shipment</h3>
          <p>Search by ID or destination, then filter by status or risk.</p>
        </div>
        <span className="tag">{filteredShipments.length} RESULTS</span>
      </div>

      <div className="risk-filters">
        <input
          type="search"
          aria-label="Search shipment ID or destination"
          placeholder="Search ID or destination…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filter shipment status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All statuses</option>
          <option value="On time">On time</option>
          <option value="Delayed">Delayed</option>
        </select>

        <select
          aria-label="Filter shipment risk"
          value={riskFilter}
          onChange={(event) => setRiskFilter(event.target.value)}
        >
          <option value="All">All risk levels</option>
          {RISK_LEVELS.map((level) => (
            <option key={level.name} value={level.name}>
              {level.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="risk-reset-button"
          onClick={() => {
            setSearch("");
            setStatusFilter("All");
            setRiskFilter("All");
          }}
        >
          Reset filters
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shipment</th>
              <th>Destination</th>
              <th>Risk category</th>
              <th>Delay</th>
              <th>Shipping cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredShipments.map((shipment) => {
              const color =
                RISK_LEVELS.find((level) => level.name === shipment.risk)
                  ?.color ?? "#5267e8";

              return (
                <tr key={shipment.id}>
                  <td className="shipment-id">{shipment.id}</td>
                  <td>{shipment.destination}</td>
                  <td>
                    <span
                      className="risk-insight-badge"
                      style={{
                        color,
                        backgroundColor: `${color}18`,
                      }}
                    >
                      {shipment.risk}
                    </span>
                  </td>
                  <td>{shipment.delay} hrs</td>
                  <td>{formatINR(shipment.shipping_cost_inr)}</td>
                </tr>
              );
            })}
            {filteredShipments.length === 0 && (
              <tr>
                <td colSpan={5} className="risk-no-results">
                  No shipments match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="risk-disclaimer">
        Risk levels are illustrative rules based on current delay hours, not
        predictions from a trained model. All records are synthetic demo data.
      </p>
    </section>
  );
}

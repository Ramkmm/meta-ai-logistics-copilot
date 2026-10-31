import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import RiskInsights from "./RiskInsights";
import ModelEvaluation from "./ModelEvaluation";
import MLShipmentRisk from "./MLShipmentRisk";
import DelhiveryDuration from "./DelhiveryDuration";
import RouteEstimator from "./RouteEstimator";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getShipmentRisk(shipment) {
  const delay = Number(shipment.delay_hours) || 0;
  if (shipment.status !== "Delayed" || delay <= 0) {
    return { label: "On track", tone: "risk-good" };
  }
  if (delay >= 10) return { label: "High risk", tone: "risk-high" };
  if (delay >= 6) return { label: "Medium risk", tone: "risk-medium" };
  return { label: "Low risk", tone: "risk-low" };
}

function getInventoryRisk(item) {
  const stock = Number(item.stock) || 0;
  const reorderLevel = Number(item.reorder_level) || 0;
  if (reorderLevel <= 0 || stock >= reorderLevel) {
    return { label: "Healthy", tone: "risk-good" };
  }
  const shortageRatio = (reorderLevel - stock) / reorderLevel;
  if (shortageRatio >= 0.5) return { label: "High risk", tone: "risk-high" };
  return { label: "Restock soon", tone: "risk-medium" };
}

const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [question, setQuestion] = useState(
    "Which shipment should be prioritized and which items need restocking?"
  );
  const [analysis, setAnalysis] = useState(null);
  const [routeContext, setRouteContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewedActions, setReviewedActions] = useState(() => new Set());

  async function loadDashboard() {
    setError("");
    try {
      const response = await fetch(`${API}/dashboard`);
      if (!response.ok) throw new Error("Dashboard request failed");
      setDashboard(await response.json());
    } catch {
      setError(
        "Cannot connect to the backend. Ensure FastAPI is running at 127.0.0.1:8000."
      );
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);


async function askCopilot(event) {
  event.preventDefault();
  setLoading(true);
  setAnalysis(null);
  setError("");

  try {
    const response = await fetch(`${API}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        route_context: routeContext,
      }),
    });

    if (!response.ok) throw new Error("Analysis request failed");
    setAnalysis(await response.json());
  } catch {
    setError("Analysis failed. Check that the FastAPI backend is running.");
  } finally {
    setLoading(false);
  }
}

  const metrics = dashboard?.metrics;
  const chartData = dashboard?.shipments?.map((shipment) => ({
    name: shipment.id.replace("SHP-", ""),
    delay: shipment.delay_hours,
  })) ?? [];

const health = (() => {
  if (!dashboard?.shipments?.length || !dashboard?.inventory?.length) {
    return null;
  }

  const shipments = dashboard.shipments;
  const inventory = dashboard.inventory;

  const onTimeScore =
    (shipments.filter((s) => s.status === "On time").length /
      shipments.length) * 100;

  const totalDelayHours = shipments.reduce(
    (sum, shipment) => sum + Math.max(0, shipment.delay_hours || 0),
    0
  );

  // Reference: 12 delay-hours per shipment.
  const maxReferenceDelay = shipments.length * 12;

  const reliabilityScore = Math.max(
    0,
    100 - (totalDelayHours / maxReferenceDelay) * 100
  );

  const healthyInventoryCount = inventory.filter(
    (item) => item.stock >= item.reorder_level
  ).length;

  const inventoryScore =
    (healthyInventoryCount / inventory.length) * 100;

  const score = Math.round(
    onTimeScore * 0.5 +
    reliabilityScore * 0.3 +
    inventoryScore * 0.2
  );

  const status =
    score >= 80
      ? "Healthy"
      : score >= 60
        ? "Needs Attention"
        : "Critical";

  return {
    score,
    status,
    onTimeScore: Math.round(onTimeScore),
    reliabilityScore: Math.round(reliabilityScore),
    inventoryScore: Math.round(inventoryScore),
  };
})();

  const priorityActions = [
    ...(dashboard?.shipments ?? [])
      .filter((shipment) => shipment.status === "Delayed" && Number(shipment.delay_hours) > 0)
      .map((shipment) => {
        const delay = Number(shipment.delay_hours) || 0;
        return {
          id: shipment.id,
          title: `${shipment.id} — ${shipment.destination}`,
          detail: `Delayed by ${delay} hours`,
          score: delay >= 10 ? 100 : delay >= 6 ? 75 : 50,
          priority: delay >= 10 ? "Critical" : delay >= 6 ? "High" : "Moderate",
          type: "shipment",
          targetId: `shipment-${shipment.id}`,
        };
      }),
    ...(dashboard?.inventory ?? [])
      .filter((item) => Number(item.stock) < Number(item.reorder_level))
      .map((item) => {
        const stock = Number(item.stock) || 0;
        const reorderLevel = Number(item.reorder_level) || 0;
        const shortage = Math.max(0, reorderLevel - stock);
        const shortageRatio = reorderLevel > 0 ? shortage / reorderLevel : 0;
        return {
          id: item.item,
          title: `Restock ${item.item}`,
          detail: `${shortage} units needed to reach reorder level`,
          score: stock === 0 ? 110 : shortageRatio >= 0.5 ? 80 : 60,
          priority: stock === 0 ? "Critical" : shortageRatio >= 0.5 ? "High" : "Moderate",
          type: "inventory",
          targetId: `inventory-${item.item.toLowerCase().replace(/\s+/g, "-")}`,
        };
      }),
  ].sort((a, b) => b.score - a.score);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Truck size={23} /></div>
          <div>
            <strong>LogiCopilot</strong>
            <span>SUPPLY CHAIN INTELLIGENCE</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <a className="nav-item active" href="#overview">
          <ChartNoAxesCombined size={18} /> Overview
        </a>
        <a className="nav-item" href="#shipments">
          <Package size={18} /> Shipments
        </a>
        <a className="nav-item" href="#inventory">
          <Boxes size={18} /> Inventory
        </a>
        <a className="nav-item" href="#copilot">
          <Bot size={18} /> AI Copilot
        </a>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>Demo environment</strong>
            <span>Sample data connected</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">OPERATIONS CENTER / INDIA</p>
            <h1>Logistics overview</h1>
            <p className="subtitle">
              Monitor deliveries, inventory and operating costs.
            </p>
          </div>
          <button className="refresh-button" onClick={loadDashboard}>
            <RefreshCw size={16} /> Refresh data
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        {!metrics ? (
          <div className="loading-panel">Loading logistics data…</div>
        ) : (
          <>
            <section className="metrics-grid" id="overview">
              <Metric
                title="Total shipments"
                value={metrics.total_shipments}
                note="Tracked in this demo"
                icon={<Truck />}
                tone="blue"
              />
              <Metric
                title="Delayed shipments"
                value={metrics.delayed_shipments}
                note="Require attention"
                icon={<Clock3 />}
                tone="orange"
              />
              <Metric
                title="On-time delivery"
                value={`${metrics.on_time_rate_percent}%`}
                note={`${metrics.on_time_shipments} delivered on time`}
                icon={<CheckCircle2 />}
                tone="green"
              />
              <Metric
                title="Shipping costs"
                value={formatINR(metrics.total_shipping_cost_inr)}
                note="Total sample shipping cost"
                icon={<CircleDollarSign />}
                tone="purple"
              />
            </section>
            <section className="panel health-panel" aria-labelledby="health-title">
  <div className="panel-heading">
    <div>
      <h2 id="health-title">Business Health Score</h2>
      <p>Operational health calculated from current dashboard data</p>
    </div>
    <span
      className={`health-status ${
        health?.status === "Healthy"
          ? "health-good"
          : health?.status === "Needs Attention"
            ? "health-warning"
            : "health-critical"
      }`}
    >
      {health?.status ?? "Unavailable"}
    </span>
  </div>

  {health && (
    <div className="health-layout">
      <div className="health-score-block">
        <div
          className={`health-score-ring ${
            health.score >= 80
              ? "ring-good"
              : health.score >= 60
                ? "ring-warning"
                : "ring-critical"
          }`}
          style={{
            "--health-progress": `${health.score * 3.6}deg`,
          }}
          role="img"
          aria-label={`Business Health Score ${health.score} out of 100`}
        >
          <div className="health-score-inner">
            <ShieldCheck size={23} />
            <strong>{health.score}</strong>
            <span>out of 100</span>
          </div>
        </div>
        <p className="health-score-caption">Overall operational score</p>
      </div>

      <div className="health-breakdown">
        <HealthFactor
          title="On-time delivery"
          score={health.onTimeScore}
          weight="50% weight"
        />
        <HealthFactor
          title="Shipment reliability"
          score={health.reliabilityScore}
          weight="30% weight"
        />
        <HealthFactor
          title="Inventory health"
          score={health.inventoryScore}
          weight="20% weight"
        />
      </div>
    </div>
  )}

  <p className="health-disclaimer">
    Demo indicator based on sample shipments and inventory. Shipment
    reliability uses a 12-hour-per-shipment reference. This is not a
    financial rating or a prediction of future business performance.
  </p>
</section>

            <section className="panel priority-panel" id="priorities">
              <div className="panel-heading">
                <div>
                  <h2>Priority Actions</h2>
                  <p>Urgent shipments and stock shortages, ranked by urgency</p>
                </div>
                <span className="tag">{priorityActions.length} ACTIONS</span>
              </div>

              {priorityActions.length === 0 ? (
                <p className="priority-empty">
                  No shipment delays or inventory shortages detected.
                </p>
              ) : (
                <div className="priority-list">
                  {priorityActions.map((action, index) => (
                    <article
                      className="priority-item"
                      key={`${action.type}-${action.id}`}
                    >
                      <span className="priority-number">{index + 1}</span>
                      <div className="priority-copy">
                        <strong>{action.title}</strong>
                        <span>{action.detail}</span>
                        {reviewedActions.has(action.id) && (
                          <span className="priority-reviewed-label">
                            <CircleCheck size={13} /> Reviewed
                          </span>
                        )}
                      </div>
                      <div className="priority-controls">
                        <span className={`priority-badge priority-${action.priority.toLowerCase()}`}>
                          {action.priority}
                        </span>
                        <button
                          type="button"
                          className="priority-action-button"
                          onClick={() => {
                            const target = document.getElementById(action.targetId);
                            target?.scrollIntoView({ behavior: "smooth", block: "center" });
                            target?.classList.add("priority-target-highlight");
                            window.setTimeout(() => {
                              target?.classList.remove("priority-target-highlight");
                            }, 1800);
                          }}
                        >
                          Open record
                        </button>
                        <button
                          type="button"
                          className={`priority-review-button ${reviewedActions.has(action.id) ? "is-reviewed" : ""}`}
                          aria-pressed={reviewedActions.has(action.id)}
                          onClick={() => setReviewedActions((previous) => {
                            const next = new Set(previous);
                            if (next.has(action.id)) next.delete(action.id);
                            else next.add(action.id);
                            return next;
                          })}
                        >
                          {reviewedActions.has(action.id) ? "Undo review" : "Mark reviewed"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="content-grid">
              <div className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Delivery delay analysis</h2>
                    <p>Delay hours by shipment</p>
                  </div>
                  <span className="tag">SAMPLE DATA</span>
                </div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} />
                      <Tooltip />
                      <Bar
                        dataKey="delay"
                        name="Delay hours"
                        fill="#5267e8"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="panel inventory-panel" id="inventory">
                <div className="panel-heading">
                  <div>
                    <h2>Inventory alerts</h2>
                    <p>Items below reorder level</p>
                  </div>
                  <AlertTriangle size={20} color="#d97706" />
                </div>
                {dashboard.inventory.map((item) => {
                  const low = item.stock < item.reorder_level;
                  return (
                    <div
                      className="inventory-item"
                      key={item.item}
                      id={`inventory-${item.item.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="item-icon"><Boxes size={18} /></div>
                      <div className="item-info">
                        <strong>{item.item}</strong>
                        <span>
                          Stock: {item.stock} · Reorder at {item.reorder_level}
                        </span>
                      </div>
                      <div className="inventory-badges">
                        <span className={`stock-badge ${low ? "low" : "healthy"}`}>
                          {low ? "Low stock" : "Healthy"}
                        </span>
                        <span className={`risk-badge ${getInventoryRisk(item).tone}`}>
                          {getInventoryRisk(item).label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <MLShipmentRisk />
            <DelhiveryDuration />
            <RouteEstimator onRouteEstimated={setRouteContext} />
            <RiskInsights shipments={dashboard.shipments} />
            <ModelEvaluation />

            <section className="panel shipments-panel" id="shipments">
              <div className="panel-heading">
                <div>
                  <h2>Shipment tracking</h2>
                  <p>Delivery status and transport costs</p>
                </div>
                <span className="tag">{dashboard.shipments.length} SHIPMENTS</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Shipment ID</th>
                      <th>Destination</th>
                      <th>Status</th>
                      <th>Delay</th>
                      <th>Shipping cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.shipments.map((shipment) => (
                      <tr key={shipment.id} id={`shipment-${shipment.id}`}>
                        <td className="shipment-id">{shipment.id}</td>
                        <td>{shipment.destination}</td>
                        <td>
                          <div className="shipment-status-cell">
                            <span className={`status-badge ${
                              shipment.status === "Delayed" ? "delayed" : "ontime"
                            }`}>
                              {shipment.status}
                            </span>
                            <span className={`risk-badge ${getShipmentRisk(shipment).tone}`}>
                              {getShipmentRisk(shipment).label}
                            </span>
                          </div>
                        </td>
                        <td>{shipment.delay_hours} hrs</td>
                        <td>{formatINR(shipment.shipping_cost_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel copilot-panel" id="copilot">
              <div className="copilot-title">
                <div className="copilot-icon"><Bot size={23} /></div>
                <div>
                  <h2>AI Logistics Copilot</h2>
                  <p>Ask questions about shipments and inventory.</p>
                </div>
                <span className="tag">
                {analysis?.mode === "meta-api"
                ? "META AI": analysis?.mode === "local-rules"
                ? "RULES MODE"
                : "AI COPILOT"}
                </span>
                </div>

              <form onSubmit={askCopilot} className="question-form">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  minLength={3}
                  maxLength={1000}
                  placeholder="Ask about delayed deliveries or inventory…"
                  required
                />
                <button type="submit" disabled={loading}>
                  {loading ? "Analyzing…" : "Analyze"} <Send size={16} />
                </button>
              </form>

              {analysis && (
                <div className="analysis-result">
                  <div className="result-heading">
                    <Activity size={18} />
                    <strong>Analysis results</strong>
                    <span>{analysis.mode}</span>
                  </div>
                  {analysis.findings?.map((finding) => (
                    <p className="result-line" key={finding}><span className="finding-bullet" aria-hidden="true">•</span>{finding}</p>
                  ))}
                  {analysis.recommendations && (
                    <>
                      <h3>Recommended actions</h3>
                      <ol>
                        {analysis.recommendations.map((recommendation) => (
                          <li key={recommendation}>{recommendation}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  {analysis.message && (
                    <div className="ai-message">
                      {analysis.message.split("\n").map((line, index) => {
                        const cleaned = line
                          .replace(/\*\*/g, "")
                          .replace(/^#{1,6}\s*/, "")
                          .trim();
                        if (!cleaned) return null;

                        const bulletMatch = cleaned.match(/^(?:[-*•])\s+(.+)$/);
                        const numberedMatch = cleaned.match(/^\d+[.)]\s+(.+)$/);

                        if (bulletMatch) {
                          return (
                            <p className="ai-message-list-item" key={index}>
                              <span className="finding-bullet" aria-hidden="true">•</span>
                              {bulletMatch[1]}
                            </p>
                          );
                        }
                        if (numberedMatch) {
                          return (
                            <p className="ai-message-list-item" key={index}>
                              <strong>{cleaned.match(/^\d+/)[0]}.</strong> {numberedMatch[1]}
                            </p>
                          );
                        }
                        return <p key={index}>{cleaned}</p>;
                      })}
                    </div>
                  )}
                  {analysis.note && <p className="muted-note">{analysis.note}</p>}
                </div>
              )}
            </section>

            <footer>
              AI Logistics & Supply Chain Copilot · Prototype · Sample data only
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ title, value, note, icon, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <p>{title}</p>
      <strong className="metric-value">{value}</strong>
      <span>{note}</span>
    </article>
  );
}
function HealthFactor({ title, score, weight }) {
  return (
    <div className="health-factor">
      <div className="health-factor-heading">
        <strong>{title}</strong>
        <span>{score}/100</span>
      </div>

      <div
        className="health-track"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div
          className="health-track-fill"
          style={{ width: `${score}%` }}
        />
      </div>

      <span className="health-weight">{weight}</span>
    </div>
  );
}
export default App;

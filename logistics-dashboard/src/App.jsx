
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Package,
  RefreshCw,
  Send,
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

const API = "http://127.0.0.1:8000";

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [question, setQuestion] = useState(
    "Which shipment should be prioritized and which items need restocking?"
  );
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        body: JSON.stringify({ question }),
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
                value={`₹${metrics.total_shipping_cost_inr.toLocaleString("en-IN")}`}
                note="Total sample shipping cost"
                icon={<CircleDollarSign />}
                tone="purple"
              />
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
                    <div className="inventory-item" key={item.item}>
                      <div className="item-icon"><Boxes size={18} /></div>
                      <div className="item-info">
                        <strong>{item.item}</strong>
                        <span>
                          Stock: {item.stock} · Reorder at {item.reorder_level}
                        </span>
                      </div>
                      <span className={`stock-badge ${low ? "low" : "healthy"}`}>
                        {low ? "Low stock" : "Healthy"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

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
                      <tr key={shipment.id}>
                        <td className="shipment-id">{shipment.id}</td>
                        <td>{shipment.destination}</td>
                        <td>
                          <span className={`status-badge ${
                            shipment.status === "Delayed" ? "delayed" : "ontime"
                          }`}>
                            {shipment.status}
                          </span>
                        </td>
                        <td>{shipment.delay_hours} hrs</td>
                        <td>₹{shipment.shipping_cost_inr.toLocaleString("en-IN")}</td>
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
                <span className="tag">RULES MODE</span>
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
                    <p className="result-line" key={finding}>• {finding}</p>
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
                  {analysis.message && <p>{analysis.message}</p>}
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

export default App;

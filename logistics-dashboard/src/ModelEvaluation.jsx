
import { useState } from "react";
import { Activity, CheckCircle2, CircleAlert, Play, RotateCcw } from "lucide-react";
import "./ModelEvaluation.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TEST_CASES = [
  {
    id: "delay",
    title: "Shipment delay triage",
    question:
      "Using the available shipment data, identify the shipment with the greatest delay, explain the risk, and recommend the next operational action.",
    expected:
      "The response identifies the most delayed shipment in the supplied data, explains the delay, and recommends a relevant follow-up.",
  },
  {
    id: "inventory",
    title: "Inventory shortage",
    question:
      "Using the available inventory data, identify items below their reorder levels and recommend which item should be restocked first. Explain why.",
    expected:
      "The response identifies a low-stock item from the supplied data and gives a reasoned restocking recommendation.",
  },
  {
    id: "combined",
    title: "Operations prioritization",
    question:
      "Review the available shipment and inventory data. Give the top three operational priorities, with evidence and a practical action for each.",
    expected:
      "The response gives relevant priorities grounded in the supplied data and suggests actionable next steps.",
  },
];

function getResponseText(data) {
  const parts = [];

  if (Array.isArray(data?.findings)) {
    parts.push(...data.findings.map(String));
  }
  if (Array.isArray(data?.recommendations)) {
    parts.push(...data.recommendations.map(String));
  }
  if (typeof data?.message === "string") {
    parts.push(data.message);
  }

  return parts.filter(Boolean).join("\n").trim();
}

function getModeLabel(mode) {
  if (mode === "meta-api") return "Meta AI";
  if (mode === "local-rules") return "Rules fallback";
  return mode || "Unknown";
}

export default function ModelEvaluation() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [activeTest, setActiveTest] = useState("");

  async function runTest(test) {
    setActiveTest(test.id);
    setResults((previous) => ({
      ...previous,
      [test.id]: { status: "running" },
    }));

    const startedAt = performance.now();

    try {
      const response = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: test.question }),
      });

      const elapsedMs = Math.round(performance.now() - startedAt);
      const rawBody = await response.text();

      let data;
      try {
        data = JSON.parse(rawBody);
      } catch {
        throw new Error(
          `API returned a non-JSON response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || `HTTP ${response.status}`
        );
      }

      const output = getResponseText(data);
      const mode = data?.mode || "unknown";
      const hasContent = output.length > 0;
      const hasMode = Boolean(data?.mode);
      const structurePass = hasContent && hasMode;

      setResults((previous) => ({
        ...previous,
        [test.id]: {
          status: "complete",
          mode,
          elapsedMs,
          output,
          data,
          hasContent,
          hasMode,
          structurePass,
          httpStatus: response.status,
          expected: test.expected,
        },
      }));
    } catch (error) {
      setResults((previous) => ({
        ...previous,
        [test.id]: {
          status: "error",
          error: error?.message || "Request failed",
          elapsedMs: Math.round(performance.now() - startedAt),
        },
      }));
    } finally {
      setActiveTest("");
    }
  }

  async function runAll() {
    if (running) return;
    setRunning(true);

    try {
      for (const test of TEST_CASES) {
        await runTest(test);
      }
    } finally {
      setRunning(false);
    }
  }

  function resetResults() {
    if (running) return;
    setResults({});
  }

  const completed = Object.values(results).filter(
    (result) => result.status === "complete"
  );
  const errors = Object.values(results).filter(
    (result) => result.status === "error"
  );
  const structurePasses = completed.filter(
    (result) => result.structurePass
  ).length;
  const metaResponses = completed.filter(
    (result) => result.mode === "meta-api"
  ).length;
  const fallbackResponses = completed.filter(
    (result) => result.mode === "local-rules"
  ).length;

  return (
    <section className="panel evaluation-panel" id="evaluation">
      <div className="panel-heading">
        <div>
          <h2>Model Evaluation &amp; Reliability</h2>
          <p>
            Run repeatable logistics scenarios against the deployed analysis
            API.
          </p>
        </div>
        <span className="tag">LIVE API TESTS</span>
      </div>

      <div className="evaluation-notice">
        <Activity size={18} />
        <p>
          These tests measure API availability, response time, response
          structure, and model mode. They do not automatically prove that an
          answer is factually correct.
        </p>
      </div>

      <div className="evaluation-summary">
        <article>
          <span>Tests completed</span>
          <strong>{completed.length} / {TEST_CASES.length}</strong>
        </article>
        <article>
          <span>Structured responses</span>
          <strong>{structurePasses}</strong>
        </article>
        <article>
          <span>Meta AI responses</span>
          <strong>{metaResponses}</strong>
        </article>
        <article>
          <span>Rules fallback</span>
          <strong>{fallbackResponses}</strong>
        </article>
      </div>

      {errors.length > 0 && (
        <p className="evaluation-error-count">
          {errors.length} test(s) encountered an API or network error.
        </p>
      )}

      <div className="evaluation-actions">
        <button
          type="button"
          className="evaluation-primary-button"
          onClick={runAll}
          disabled={running}
        >
          <Play size={15} />
          {running ? `Running ${activeTest || "tests"}…` : "Run all tests"}
        </button>
        <button
          type="button"
          className="evaluation-reset-button"
          onClick={resetResults}
          disabled={running || Object.keys(results).length === 0}
        >
          <RotateCcw size={15} /> Reset results
        </button>
      </div>

      <div className="evaluation-test-list">
        {TEST_CASES.map((test) => {
          const result = results[test.id];

          return (
            <article className="evaluation-test-card" key={test.id}>
              <div className="evaluation-test-heading">
                <div>
                  <h3>{test.title}</h3>
                  <p>{test.question}</p>
                </div>

                <span
                  className={`evaluation-status ${
                    result?.status === "complete"
                      ? result.structurePass
                        ? "evaluation-success"
                        : "evaluation-warning"
                      : result?.status === "error"
                        ? "evaluation-failed"
                        : ""
                  }`}
                >
                  {result?.status === "running"
                    ? "Running"
                    : result?.status === "error"
                      ? "Error"
                      : result?.status === "complete"
                        ? result.structurePass
                          ? "Response received"
                          : "Incomplete response"
                        : "Not run"}
                </span>
              </div>

              <div className="evaluation-expected">
                <strong>Human review criteria</strong>
                <p>{test.expected}</p>
              </div>

              <button
                type="button"
                className="evaluation-run-button"
                onClick={() => runTest(test)}
                disabled={running}
              >
                {result?.status === "running" ? "Testing…" : "Run this test"}
              </button>

              {result?.status === "error" && (
                <div className="evaluation-result-error">
                  <CircleAlert size={17} />
                  <span>{result.error}</span>
                </div>
              )}

              {result?.status === "complete" && (
                <div className="evaluation-result">
                  <div className="evaluation-result-metrics">
                    <span>
                      Mode: <strong>{getModeLabel(result.mode)}</strong>
                    </span>
                    <span>
                      Latency: <strong>{result.elapsedMs} ms</strong>
                    </span>
                    <span>
                      HTTP: <strong>{result.httpStatus}</strong>
                    </span>
                    <span>
                      {result.structurePass ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <CircleAlert size={15} />
                      )}
                      {result.structurePass
                        ? "Basic structure passed"
                        : "Check response structure"}
                    </span>
                  </div>

                  <details>
                    <summary>Inspect response</summary>
                    <pre>{result.output || "No findings, recommendations, or message returned."}</pre>
                  </details>

                  <details>
                    <summary>Inspect response metadata</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          mode: result.mode,
                          note: result.data?.note,
                          hasFindings: Array.isArray(result.data?.findings),
                          hasRecommendations: Array.isArray(
                            result.data?.recommendations
                          ),
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="evaluation-disclaimer">
        Latency is measured in the browser from request start until the response
        body is read. Meta AI versus rules fallback is determined from the API
        response mode. Human review is still required to assess factual
        correctness.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Phase 2 — Website Health Audit dashboard client.
 *
 * Run on-demand audits, browse findings grouped by severity/category with
 * filters, and review audit history. All data comes from the owner-only API;
 * findings are evidence-based (measured/heuristic), never fabricated.
 */

type Finding = {
  id: string;
  category: "seo" | "accessibility" | "security" | "performance" | "crawlability";
  severity: "error" | "warning" | "info";
  check: string;
  url: string;
  evidence: string;
  recommendation: string;
  method: "measured" | "heuristic";
};

type AuditSummary = {
  id: string;
  targetUrl: string;
  status: "running" | "completed" | "failed";
  pagesCrawled: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  findingCounts: { error: number; warning: number; info: number };
};

type AuditDetail = AuditSummary & { findings: Finding[] };

const SEVERITY_BADGE: Record<Finding["severity"], string> = {
  error: "room-badge-warning",
  warning: "room-badge-warning",
  info: "room-badge-info",
};

const CATEGORY_LABEL: Record<Finding["category"], string> = {
  seo: "SEO",
  accessibility: "Accessibility",
  security: "Security",
  performance: "Performance",
  crawlability: "Crawlability",
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export function HealthAuditClient({ defaultTarget }: { defaultTarget: string }) {
  const [target, setTarget] = useState(defaultTarget);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AuditDetail | null>(null);
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  async function loadHistory() {
    try {
      const res = await fetch("/api/faisals-room/health/audits");
      const data = (await res.json()) as { audits?: AuditSummary[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load audit history.");
      setHistory(data.audits ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not load audit history.");
    }
  }

  useEffect(() => { loadHistory(); }, []);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim() || running) return;
    setRunning(true);
    setRunError(null);
    setCurrent(null);
    try {
      const res = await fetch("/api/faisals-room/health/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: target.trim() }),
      });
      const data = (await res.json()) as { audit?: AuditDetail; error?: string };
      if (!res.ok) throw new Error(data.error ?? "The audit could not be completed.");
      setCurrent(data.audit ?? null);
      await loadHistory();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "The audit could not be completed.");
    } finally {
      setRunning(false);
    }
  }

  async function openAudit(id: string) {
    try {
      const res = await fetch(`/api/faisals-room/health/audits/${id}`);
      const data = (await res.json()) as { audit?: AuditDetail; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load audit.");
      setCurrent(data.audit ?? null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Could not load audit.");
    }
  }

  const findings = current?.findings.filter(
    (f) =>
      (!severityFilter || f.severity === severityFilter) &&
      (!categoryFilter || f.category === categoryFilter),
  ) ?? [];

  return (
    <div>
      {/* Run audit */}
      <section className="room-card" aria-label="Run a health audit">
        <h2 style={{ marginTop: 0 }}>Run audit</h2>
        <form onSubmit={handleRun} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <label htmlFor="audit-target" style={{ position: "absolute", left: "-9999px" }}>
            Target URL
          </label>
          <input
            id="audit-target"
            type="url"
            className="room-input"
            placeholder="https://example.com"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ flex: "1 1 240px" }}
            disabled={running}
            required
          />
          <button type="submit" className="room-button room-button-primary" disabled={running || !target.trim()}>
            {running ? "Auditing… (up to ~60s)" : "Run audit"}
          </button>
        </form>
        <p className="room-editor-help" style={{ marginBottom: 0 }}>
          On-demand only. Audits up to 10 pages with a 10s timeout per request.
          Targets pass SSRF protection: only public HTTP/HTTPS addresses are fetched.
        </p>
        {runError && (
          <div className="room-alert room-alert-error" role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <strong>Audit failed.</strong> {runError}
          </div>
        )}
      </section>

      {/* Results */}
      {running && (
        <section className="room-card" style={{ marginTop: "1rem" }} aria-label="Audit in progress">
          <div role="status">
            <p><strong>Auditing…</strong></p>
            <p className="room-editor-help">Fetching pages and running checks. This can take up to a minute.</p>
          </div>
        </section>
      )}

      {current && current.status === "completed" && (
        <section className="room-card" style={{ marginTop: "1rem" }} aria-label="Audit results">
          <h2 style={{ marginTop: 0 }}>Results</h2>
          <p className="room-editor-help">
            {current.targetUrl} · {current.pagesCrawled} page(s) crawled ·{" "}
            {current.completedAt ? formatDateTime(current.completedAt) : ""}
          </p>
          <div className="room-metric-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <div className="room-metric"><span>Errors</span><strong>{current.findingCounts.error}</strong></div>
            <div className="room-metric"><span>Warnings</span><strong>{current.findingCounts.warning}</strong></div>
            <div className="room-metric"><span>Info</span><strong>{current.findingCounts.info}</strong></div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <select className="room-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} aria-label="Filter by severity">
              <option value="">All severities</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
            <select className="room-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {findings.length === 0 ? (
            <p className="room-editor-help" role="status">
              {current.findings.length === 0
                ? "No findings — the crawled pages passed all checks."
                : "No findings match the selected filters."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {findings.map((f) => (
                <article key={f.id} className="room-lead-card">
                  <div className="room-lead-head">
                    <h3>{f.check.replace(/-/g, " ")}</h3>
                    <span className={`room-badge ${SEVERITY_BADGE[f.severity]}`}>{f.severity}</span>
                  </div>
                  <p className="room-editor-help" style={{ margin: "0.25rem 0" }}>
                    {CATEGORY_LABEL[f.category]} · {f.method} ·{" "}
                    <span style={{ wordBreak: "break-all" }}>{f.url}</span>
                  </p>
                  <p style={{ fontSize: "12px", margin: "0.5rem 0" }}>
                    <strong>Evidence:</strong> {f.evidence}
                  </p>
                  <p style={{ fontSize: "12px", margin: 0 }}>
                    <strong>Fix:</strong> {f.recommendation}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {current && current.status === "failed" && (
        <div className="room-alert room-alert-error" role="alert" style={{ marginTop: "1rem" }}>
          <strong>Audit failed.</strong> {current.errorMessage ?? "The target could not be audited."}
        </div>
      )}

      {/* History */}
      <section className="room-card" style={{ marginTop: "1rem" }} aria-label="Audit history">
        <h2 style={{ marginTop: 0 }}>History</h2>
        {historyError ? (
          <div className="room-alert room-alert-error" role="alert" style={{ marginBottom: 0 }}>
            {historyError}
          </div>
        ) : history.length === 0 ? (
          <p className="room-editor-help" role="status" style={{ marginBottom: 0 }}>
            No audits yet. Run your first audit above.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="room-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Target</th>
                  <th style={{ textAlign: "right" }}>Errors</th>
                  <th style={{ textAlign: "right" }}>Warnings</th>
                  <th style={{ textAlign: "right" }}>Pages</th>
                  <th style={{ textAlign: "right" }}>When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} onClick={() => openAudit(a.id)} style={{ cursor: "pointer" }}>
                    <td style={{ wordBreak: "break-all", fontWeight: 600 }}>{a.targetUrl}</td>
                    <td style={{ textAlign: "right" }}>{a.findingCounts.error}</td>
                    <td style={{ textAlign: "right" }}>{a.findingCounts.warning}</td>
                    <td style={{ textAlign: "right" }}>{a.pagesCrawled}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatDateTime(a.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

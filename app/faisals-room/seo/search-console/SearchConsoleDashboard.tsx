"use client";

import { useEffect, useState } from "react";

/**
 * Phase 2 — Search Console dashboard client.
 *
 * Honest states only. No mock data is presented as real search data.
 * The Connect button initiates the Google OAuth flow with the
 * webmasters.readonly scope (independent from the GA4 connection).
 *
 * Metrics shown here are Search Console metrics (clicks, impressions,
 * CTR, position) — deliberately distinct from GA4 metrics (sessions,
 * users, pageviews). They are never mixed.
 */

type DashboardState =
  | { kind: "not_connected"; oauth?: string }
  | { kind: "connected"; siteUrl: string | null }
  | { kind: "loading" }
  | { kind: "error"; message: string };

type GscSite = {
  siteUrl: string;
  permissionLevel: string;
};

type GscTopQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number };
type GscTopPage = { page: string; clicks: number; impressions: number; ctr: number; position: number };

type GscReport = {
  clicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: GscTopQuery[];
  topPages: GscTopPage[];
  dateRange: string;
  startDate: string;
  endDate: string;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
};

type DateRangeKey = "7d" | "28d" | "90d";
const DATE_RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: "7d", label: "Last 7 days" },
  { key: "28d", label: "Last 28 days" },
  { key: "90d", label: "Last 3 months" },
];

const OAUTH_MESSAGES: Record<string, { kind: "success" | "warning" | "error"; text: string }> = {
  connected: { kind: "success", text: "Search Console connected. Select a site to see data." },
  denied: { kind: "warning", text: "Google authorization was declined. No data was accessed." },
  provider_error: { kind: "error", text: "Google returned an error. Please try again." },
  invalid_request: { kind: "error", text: "Invalid OAuth request. Please try connecting again." },
  rate_limited: { kind: "warning", text: "Too many attempts. Please wait before trying again." },
  session_expired: { kind: "warning", text: "Your session expired during authorization. Please sign in and try again." },
  misconfigured: { kind: "error", text: "Google OAuth is not configured correctly. Contact the site owner." },
  failed: { kind: "error", text: "Connection failed. Please try again." },
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatPercent(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

function formatPosition(pos: number): string {
  return pos > 0 ? pos.toFixed(1) : "—";
}

function formatFetchedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SearchConsoleDashboardClient({ initialState }: { initialState: DashboardState }) {
  const [state] = useState<DashboardState>(initialState);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const response = await fetch("/api/faisals-room/search-console/oauth/start", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not start Google OAuth.");
      }
      window.location.href = data.url;
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not start Google OAuth.");
      setConnecting(false);
    }
  }

  if (state.kind === "not_connected") {
    const oauthNotice = state.oauth ? OAUTH_MESSAGES[state.oauth] : null;
    return (
      <div>
        {oauthNotice && (
          <div
            className={`room-alert room-alert-${oauthNotice.kind === "success" ? "info" : oauthNotice.kind}`}
            role={oauthNotice.kind === "error" ? "alert" : "status"}
            style={{ marginBottom: "1.5rem" }}
          >
            <strong>{oauthNotice.kind === "success" ? "Connected." : "Not connected."}</strong> {oauthNotice.text}
          </div>
        )}
        {!oauthNotice && (
          <div className="room-alert room-alert-info" role="status" style={{ marginBottom: "1.5rem" }}>
            <strong>Not connected.</strong> Connect Google Search Console to see real search
            performance data here. No data is collected or displayed until you connect.
          </div>
        )}
        <section className="room-card" aria-label="Connect Search Console">
          <h2 style={{ marginTop: 0 }}>Connect Search Console</h2>
          <p className="room-editor-help">
            You will be redirected to Google to authorize read-only access to your Search Console
            data. Only aggregate search metrics are fetched. Tokens are encrypted and stored
            server-side. This connection is independent from the GA4 connection.
          </p>
          {connectError && (
            <div className="room-alert room-alert-error" role="alert" style={{ marginBottom: "1rem" }}>
              {connectError}
            </div>
          )}
          <div className="room-editor-actions">
            <button
              type="button"
              className="room-button room-button-primary"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Redirecting to Google…" : "Connect Search Console"}
            </button>
          </div>
        </section>

        <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="What you will see">
          <h2>What you&apos;ll see after connecting</h2>
          <div className="room-metric-grid" aria-hidden="true">
            {["Clicks", "Impressions", "Avg. CTR", "Avg. position"].map((label) => (
              <div key={label} className="room-metric">
                <span>{label}</span>
                <strong>—</strong>
                <small>Real data only; never fabricated</small>
              </div>
            ))}
          </div>
          <p className="room-editor-help">
            Search Console data has a 2–3 day processing delay, so reports end 3 days ago.
            Every number shown comes from a real API response with a visible fetch timestamp.
          </p>
        </section>
      </div>
    );
  }

  if (state.kind === "connected") {
    return <SitePicker initialSiteUrl={state.siteUrl} />;
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-label="Loading Search Console">
        <div className="room-metric-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="room-metric" aria-hidden="true">
              <span>Loading…</span>
              <strong>—</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="room-alert room-alert-warning" role="alert">
      <strong>Could not load Search Console.</strong>{" "}
      {state.kind === "error" ? state.message : "An unexpected error occurred."}
    </div>
  );
}

function SitePicker({ initialSiteUrl }: { initialSiteUrl: string | null }) {
  const [sites, setSites] = useState<GscSite[] | null>(null);
  const [selected, setSelected] = useState(initialSiteUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function loadSites() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/faisals-room/search-console/properties");
      const data = (await response.json()) as { sites?: GscSite[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load sites.");
      setSites(data.sites ?? []);
      if ((data.sites ?? []).length === 0) {
        setError("No Search Console sites found for this Google account.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sites.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load sites on mount so a saved selection is visible immediately
  // after page reload without requiring a manual click.
  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/faisals-room/search-console/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: selected }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save site.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save site.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Search Console? This revokes access and deletes stored tokens.")) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/faisals-room/search-console/disconnect", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not disconnect.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="room-alert room-alert-info" role="status" style={{ marginBottom: "1.5rem" }}>
        <strong>Connected.</strong> Select the Search Console site to display data for.
      </div>
      <section className="room-card" aria-label="Select Search Console site">
        <h2 style={{ marginTop: 0 }}>Search Console site</h2>
        {error && (
          <div className="room-alert room-alert-error" role="alert" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        {saved && (
          <div className="room-alert room-alert-info" role="status" style={{ marginBottom: "1rem" }}>
            Site saved.
          </div>
        )}
        {sites === null ? (
          <div className="room-editor-actions">
            <button type="button" className="room-button" onClick={loadSites} disabled={loading}>
              {loading ? "Loading…" : "Load my Search Console sites"}
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="gsc-site" className="room-editor-help" style={{ display: "block", marginBottom: "0.5rem" }}>
              Choose a site:
            </label>
            <select
              id="gsc-site"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="room-input"
              style={{ marginBottom: "1rem", width: "100%" }}
            >
              <option value="">— Select —</option>
              {sites.map((s) => (
                <option key={s.siteUrl} value={s.siteUrl}>
                  {s.siteUrl} ({s.permissionLevel})
                </option>
              ))}
            </select>
            <div className="room-editor-actions">
              <button
                type="button"
                className="room-button room-button-primary"
                onClick={handleSave}
                disabled={!selected || saving}
              >
                {saving ? "Saving…" : "Save site"}
              </button>
              <button
                type="button"
                className="room-button"
                onClick={handleDisconnect}
                disabled={saving}
                style={{ marginLeft: "0.5rem" }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </section>
      {selected && <SearchMetricsDisplay siteUrl={selected} />}
    </div>
  );
}

function SearchMetricsDisplay({ siteUrl }: { siteUrl: string }) {
  const [dateRange, setDateRange] = useState<DateRangeKey>("28d");
  const [report, setReport] = useState<GscReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(range: DateRangeKey, forceRefresh: boolean) {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ dateRange: range });
      if (forceRefresh) params.set("refresh", "1");
      const response = await fetch(`/api/faisals-room/search-console/reports?${params.toString()}`);
      const data = (await response.json()) as { report?: GscReport; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load search report.");
      if (!data.report) throw new Error("Could not load search report.");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load search report.");
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadReport(dateRange, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, siteUrl]);

  function handleRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDateRange(e.target.value as DateRangeKey);
  }

  const rangeLabel = DATE_RANGES.find((r) => r.key === dateRange)?.label ?? dateRange;

  return (
    <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="Search performance">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Search performance</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label htmlFor="gsc-range" className="room-editor-help" style={{ margin: 0 }}>
            Range:
          </label>
          <select
            id="gsc-range"
            value={dateRange}
            onChange={handleRangeChange}
            className="room-input"
            disabled={loading || refreshing}
          >
            {DATE_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="room-button"
            onClick={() => loadReport(dateRange, true)}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading search data" style={{ marginTop: "1rem" }}>
          <div className="room-metric-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="room-metric" aria-hidden="true">
                <span>Loading…</span>
                <strong>—</strong>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="room-alert room-alert-error" role="alert" style={{ marginTop: "1rem" }}>
          <strong>Could not load metrics.</strong> {error}
        </div>
      ) : report ? (
        <div style={{ marginTop: "1rem" }}>
          <div className="room-metric-grid">
            <div className="room-metric">
              <span>Clicks</span>
              <strong>{formatNumber(report.clicks)}</strong>
              <small>{rangeLabel}</small>
            </div>
            <div className="room-metric">
              <span>Impressions</span>
              <strong>{formatNumber(report.impressions)}</strong>
              <small>{rangeLabel}</small>
            </div>
            <div className="room-metric">
              <span>Avg. CTR</span>
              <strong>{formatPercent(report.avgCtr)}</strong>
              <small>{rangeLabel}</small>
            </div>
            <div className="room-metric">
              <span>Avg. position</span>
              <strong>{formatPosition(report.avgPosition)}</strong>
              <small>{rangeLabel}</small>
            </div>
          </div>

          <h3 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>Top queries</h3>
          {report.topQueries.length === 0 ? (
            <p className="room-editor-help" role="status">
              No query data for this period.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="room-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Query</th>
                    <th style={{ textAlign: "right" }}>Clicks</th>
                    <th style={{ textAlign: "right" }}>Impr.</th>
                    <th style={{ textAlign: "right" }}>CTR</th>
                    <th style={{ textAlign: "right" }}>Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topQueries.map((q, i) => (
                    <tr key={`${q.query}-${i}`}>
                      <td style={{ fontWeight: 500 }}>{q.query}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(q.clicks)}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(q.impressions)}</td>
                      <td style={{ textAlign: "right" }}>{formatPercent(q.ctr)}</td>
                      <td style={{ textAlign: "right" }}>{formatPosition(q.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>Top pages</h3>
          {report.topPages.length === 0 ? (
            <p className="room-editor-help" role="status">
              No page data for this period.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="room-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Page</th>
                    <th style={{ textAlign: "right" }}>Clicks</th>
                    <th style={{ textAlign: "right" }}>Impr.</th>
                    <th style={{ textAlign: "right" }}>CTR</th>
                    <th style={{ textAlign: "right" }}>Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topPages.map((p, i) => (
                    <tr key={`${p.page}-${i}`}>
                      <td style={{ fontWeight: 500, wordBreak: "break-all" }}>{p.page}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(p.clicks)}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(p.impressions)}</td>
                      <td style={{ textAlign: "right" }}>{formatPercent(p.ctr)}</td>
                      <td style={{ textAlign: "right" }}>{formatPosition(p.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="room-editor-help" style={{ marginTop: "1rem", marginBottom: 0 }}>
            {report.startDate} → {report.endDate} · Fetched {formatFetchedAt(report.fetchedAt)}
            {report.cached ? " (cached)" : " (live)"}
            {report.stale && <strong> — data may be stale (older than 24h).</strong>}
          </p>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Phase 2 Feature 3 (Phase B+): Analytics dashboard.
 *
 * Honest states only. No mock data is presented as real analytics.
 * The Connect button initiates the real Google OAuth flow (PR-A).
 * Property selection arrived in PR-B; metrics display in Phase B+.
 */

type ConnectionState = "not_connected" | "loading" | "error";
type DashboardState =
  | { kind: "not_connected"; oauth?: string }
  | { kind: "connected"; propertyId: string | null }
  | { kind: "loading" }
  | { kind: "error"; message: string };

type GA4Property = {
  propertyId: string;
  displayName: string;
  accountName: string;
};

type TopPage = {
  pageTitle: string;
  pagePath: string;
  views: number;
};

type GA4Report = {
  sessions: number;
  totalUsers: number;
  pageViews: number;
  topPages: TopPage[];
  dateRange: string;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
};

type DateRangeKey = "7d" | "30d" | "90d";
const DATE_RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

const OAUTH_MESSAGES: Record<string, { kind: "success" | "warning" | "error"; text: string }> = {
  connected: { kind: "success", text: "Google Analytics connected. Select a property to see data." },
  denied: { kind: "warning", text: "Google authorization was declined. No data was accessed." },
  provider_error: { kind: "error", text: "Google returned an error. Please try again." },
  invalid_request: { kind: "error", text: "Invalid OAuth request. Please try connecting again." },
  rate_limited: { kind: "warning", text: "Too many attempts. Please wait before trying again." },
  session_expired: { kind: "warning", text: "Your session expired during authorization. Please sign in and try again." },
  misconfigured: { kind: "error", text: "Google OAuth is not configured correctly. Contact the site owner." },
  failed: { kind: "error", text: "Connection failed. Please try again." },
};

export function AnalyticsDashboardClient({ initialState }: { initialState: DashboardState }) {
  const [state] = useState<DashboardState>(initialState);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const response = await fetch("/api/faisals-room/analytics/oauth/start", { method: "POST" });
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
            <strong>Not connected.</strong> Connect your Google Analytics 4 property to see real
            traffic data here. No data is collected or displayed until you connect.
          </div>
        )}
        <section className="room-card" aria-label="Connect Google Analytics">
          <h2 style={{ marginTop: 0 }}>Connect Google Analytics 4</h2>
          <p className="room-editor-help">
            You will be redirected to Google to authorize read-only access to your Analytics data.
            Only aggregate metrics are fetched — no user-level data. Tokens are encrypted and stored
            server-side.
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
              {connecting ? "Redirecting to Google…" : "Connect GA4"}
            </button>
          </div>
          <p className="room-editor-help" style={{ marginTop: "0.75rem" }}>
            Requires Google Cloud OAuth credentials configured by the site owner.
          </p>
        </section>

        <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="What you will see">
          <h2>What you&apos;ll see after connecting</h2>
          <div className="room-metric-grid" aria-hidden="true">
            {["Sessions", "Total users", "Pageviews"].map((label) => (
              <div key={label} className="room-metric">
                <span>{label}</span>
                <strong>—</strong>
                <small>Real data only; never fabricated</small>
              </div>
            ))}
          </div>
          <p className="room-editor-help">
            Metrics are fetched server-side from the Google Analytics Data API. Every number shown
            comes from a real API response with a visible fetch timestamp. Empty periods show
            &ldquo;No data&rdquo; — never zeros.
          </p>
        </section>
      </div>
    );
  }

  if (state.kind === "connected") {
    return <PropertyPicker initialPropertyId={state.propertyId} />;
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-label="Loading analytics">
        <div className="room-metric-grid">
          {[1, 2, 3].map((i) => (
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
      <strong>Could not load analytics.</strong>{" "}
      {state.kind === "error" ? state.message : "An unexpected error occurred."}
    </div>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
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

/**
 * Metrics display (Phase B+). Fetches real GA4 data via the reports API.
 * Shows honest loading, empty, and error states — never fabricated numbers.
 */
function MetricsDisplay({ propertyId }: { propertyId: string }) {
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [report, setReport] = useState<GA4Report | null>(null);
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
      const response = await fetch(`/api/faisals-room/analytics/reports?${params.toString()}`);
      const data = (await response.json()) as { report?: GA4Report; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load analytics report.");
      if (!data.report) throw new Error("Could not load analytics report.");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics report.");
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadReport(dateRange, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, propertyId]);

  function handleRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDateRange(e.target.value as DateRangeKey);
  }

  const rangeLabel = DATE_RANGES.find((r) => r.key === dateRange)?.label ?? dateRange;

  return (
    <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="Analytics metrics">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Traffic overview</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label htmlFor="ga4-range" className="room-editor-help" style={{ margin: 0 }}>
            Range:
          </label>
          <select
            id="ga4-range"
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
        <div role="status" aria-label="Loading analytics" style={{ marginTop: "1rem" }}>
          <div className="room-metric-grid">
            {[1, 2, 3].map((i) => (
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
              <span>Sessions</span>
              <strong>{formatNumber(report.sessions)}</strong>
              <small>{rangeLabel}</small>
            </div>
            <div className="room-metric">
              <span>Total users</span>
              <strong>{formatNumber(report.totalUsers)}</strong>
              <small>{rangeLabel}</small>
            </div>
            <div className="room-metric">
              <span>Page views</span>
              <strong>{formatNumber(report.pageViews)}</strong>
              <small>{rangeLabel}</small>
            </div>
          </div>

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
                    <th style={{ textAlign: "right" }}>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topPages.map((p, i) => (
                    <tr key={`${p.pagePath}-${i}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.pageTitle}</div>
                        <div className="room-editor-help" style={{ margin: 0 }}>{p.pagePath}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>{formatNumber(p.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="room-editor-help" style={{ marginTop: "1rem", marginBottom: 0 }}>
            Fetched {formatFetchedAt(report.fetchedAt)}
            {report.cached ? " (cached)" : " (live)"}
            {report.stale && <strong> — data may be stale (older than 24h).</strong>}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function PropertyPicker({ initialPropertyId }: { initialPropertyId: string | null }) {
  const [properties, setProperties] = useState<GA4Property[] | null>(null);
  const [selected, setSelected] = useState(initialPropertyId ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Auto-load properties on mount so a saved selection is visible
  // immediately after page reload without requiring a manual click.
  useEffect(() => {
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProperties() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/faisals-room/analytics/properties");
      const data = (await response.json()) as { properties?: GA4Property[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load properties.");
      setProperties(data.properties ?? []);
      if ((data.properties ?? []).length === 0) {
        setError("No GA4 properties found for this Google account.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load properties.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/faisals-room/analytics/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: selected }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save property.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save property.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Analytics? This revokes access and deletes stored tokens.")) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/faisals-room/analytics/disconnect", { method: "POST" });
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
        <strong>Connected.</strong> Select the GA4 property to display data for.
      </div>
      <section className="room-card" aria-label="Select GA4 property">
        <h2 style={{ marginTop: 0 }}>GA4 Property</h2>
        {error && (
          <div className="room-alert room-alert-error" role="alert" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        {saved && (
          <div className="room-alert room-alert-info" role="status" style={{ marginBottom: "1rem" }}>
            Property saved.
          </div>
        )}
        {properties === null ? (
          <div className="room-editor-actions">
            <button type="button" className="room-button" onClick={loadProperties} disabled={loading}>
              {loading ? "Loading…" : "Load my GA4 properties"}
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="ga4-property" className="room-editor-help" style={{ display: "block", marginBottom: "0.5rem" }}>
              Choose a property:
            </label>
            <select
              id="ga4-property"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="room-input"
              style={{ marginBottom: "1rem", width: "100%" }}
            >
              <option value="">— Select —</option>
              {properties.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.displayName} ({p.propertyId}){p.accountName ? ` — ${p.accountName}` : ""}
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
                {saving ? "Saving…" : "Save property"}
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
      {selected && <MetricsDisplay propertyId={selected} />}
    </div>
  );
}

// Re-export for tests
export type { ConnectionState };

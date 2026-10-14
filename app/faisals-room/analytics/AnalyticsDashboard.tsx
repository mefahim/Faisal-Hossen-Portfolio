"use client";

import { useState } from "react";

/**
 * Phase 2 Feature 3 (Phase B Step 2, PR-A): Analytics dashboard.
 *
 * Honest states only. No mock data is presented as real analytics.
 * The Connect button initiates the real Google OAuth flow (PR-A).
 * Property selection and data display arrive in PR-B.
 */

type ConnectionState = "not_connected" | "loading" | "error";
type DashboardState =
  | { kind: "not_connected"; oauth?: string }
  | { kind: "loading" }
  | { kind: "error"; message: string };

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

// Re-export for tests
export type { ConnectionState };

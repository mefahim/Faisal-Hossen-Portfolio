"use client";

import { useState } from "react";

/**
 * Phase 2 Feature 3 (Phase A): Analytics dashboard foundation.
 *
 * Honest states only. No mock data is presented as real analytics.
 * Real GA4 data integration arrives in Phase B after Google Cloud setup.
 */

type ConnectionState = "not_connected" | "loading" | "error";
type DashboardState =
  | { kind: "not_connected" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export function AnalyticsDashboardClient({ initialState }: { initialState: DashboardState }) {
  const [state] = useState<DashboardState>(initialState);

  if (state.kind === "not_connected") {
    return (
      <div>
        <div className="room-alert room-alert-info" role="status" style={{ marginBottom: "1.5rem" }}>
          <strong>Not connected.</strong> Connect your Google Analytics 4 property to see real
          traffic data here. No data is collected or displayed until you connect.
        </div>
        <section className="room-card" aria-label="Connect Google Analytics">
          <h2 style={{ marginTop: 0 }}>Connect Google Analytics 4</h2>
          <p className="room-editor-help">
            You will be redirected to Google to authorize read-only access to your Analytics data.
            Only aggregate metrics are fetched — no user-level data. Tokens are encrypted and stored
            server-side.
          </p>
          <div className="room-editor-actions">
            <button
              type="button"
              className="room-button room-button-primary"
              disabled
              title="Available after Google Cloud setup (Phase B)"
            >
              Connect GA4 (coming soon)
            </button>
          </div>
          <p className="room-editor-help" style={{ marginTop: "0.75rem" }}>
            Requires Google Cloud OAuth credentials configured by the site owner. See setup documentation.
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

import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/server/auth";
import { getConnectionStatus } from "@/lib/server/analytics/tokens";
import { AnalyticsDashboardClient } from "./AnalyticsDashboard";

/**
 * Phase 2 Feature 3 (Phase A): Analytics dashboard.
 *
 * Shows honest connection states. Real GA4 data integration arrives in
 * Phase B after Google Cloud OAuth credentials are configured.
 */
export default async function AnalyticsPage() {
  let owner;
  try {
    owner = await getOwnerSession();
  } catch {
    redirect("/faisals-room/login");
  }
  if (!owner) redirect("/faisals-room/login");

  // Check connection status. If the provider tables don't exist yet
  // (migration not applied), treat as not connected.
  let connected = false;
  try {
    const status = await getConnectionStatus("ga4");
    connected = status !== null;
  } catch {
    connected = false;
  }

  return (
    <>
      <div className="room-page-heading">
        <div>
          <p className="room-eyebrow">Analytics / Faisal&apos;s Room</p>
          <h1>Site analytics</h1>
          <p>
            Real traffic data from Google Analytics 4 — fetched server-side, never fabricated.
            {connected ? "" : " Connect your GA4 property to get started."}
          </p>
        </div>
        <span className="room-published-badge"><span aria-hidden="true" />Private workspace</span>
      </div>
      <AnalyticsDashboardClient initialState={connected ? { kind: "loading" } : { kind: "not_connected" }} />
    </>
  );
}

import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/server/auth";
import { getConnectionStatus } from "@/lib/server/analytics/tokens";
import { SearchConsoleDashboardClient } from "./SearchConsoleDashboard";

/**
 * Phase 2 — Google Search Console dashboard.
 *
 * Shows honest connection states. Real search performance data (clicks,
 * impressions, CTR, position, top queries/pages) is fetched server-side
 * via the webmasters/v3 API — never fabricated.
 */
export default async function SearchConsolePage({
  searchParams,
}: {
  searchParams?: Promise<{ oauth?: string }>;
}) {
  let owner;
  try {
    owner = await getOwnerSession();
  } catch {
    redirect("/faisals-room/login");
  }
  if (!owner) redirect("/faisals-room/login");

  let connected = false;
  let siteUrl: string | null = null;
  try {
    const status = await getConnectionStatus("search_console", owner.userId);
    connected = status !== null;
    siteUrl = status?.propertyId ?? null;
  } catch {
    connected = false;
  }

  const params = searchParams ? await searchParams : undefined;
  const oauth = params?.oauth;

  return (
    <>
      <div className="room-page-heading">
        <div>
          <p className="room-eyebrow">SEO / Faisal&apos;s Room</p>
          <h1>Search Console</h1>
          <p>
            Real search performance data from Google Search Console — fetched server-side, never fabricated.
            {connected ? "" : " Connect your Search Console property to get started."}
          </p>
        </div>
        <span className="room-published-badge"><span aria-hidden="true" />Private workspace</span>
      </div>
      <SearchConsoleDashboardClient
        initialState={
          connected
            ? { kind: "connected", siteUrl }
            : { kind: "not_connected", oauth }
        }
      />
    </>
  );
}

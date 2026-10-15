import "server-only";
import { randomUUID } from "crypto";
import { getConnectionStatus, getValidAccessToken } from "./tokens";
import { listGscSites, querySearchAnalytics } from "./gsc-client";
import { query } from "@/lib/server/db";

/**
 * Phase 2 — Google Search Console reports.
 *
 * Fetches real search performance data via the webmasters/v3 searchAnalytics
 * API using the owner's stored OAuth token (webmasters.readonly scope).
 *
 * Security:
 * - Requires a valid (possibly refreshed) access token; never exposes tokens.
 * - Site URL comes from the owner's DB record, validated against Google's
 *   site list — never trusted from the client.
 * - Date ranges are validated against an allowlist.
 * - Results are cached per (provider, site, date_range, report_type).
 * - API errors are mapped to safe, generic messages.
 * - Auth failures and transient errors are never cached.
 *
 * Search Console data notes:
 * - Data is available for the last 16 months with a 2-3 day processing delay,
 *   so the default end date is 3 days ago.
 * - Date ranges follow GSC conventions: 7d / 28d / 90d.
 */

export type GscDateRangeKey = "7d" | "28d" | "90d";
const VALID_RANGES: readonly GscDateRangeKey[] = ["7d", "28d", "90d"];

/** GSC data lags 2-3 days; end the range 3 days ago for complete data. */
const DATA_DELAY_DAYS = 3;
/** Cache TTL: data older than this is considered stale (but still served with a badge). */
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

export type GscTopQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type GscTopPage = { page: string; clicks: number; impressions: number; ctr: number; position: number };

export type GscReport = {
  clicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: GscTopQuery[];
  topPages: GscTopPage[];
  dateRange: GscDateRangeKey;
  startDate: string;
  endDate: string;
  /** ISO timestamp of when the data was fetched (from cache or live). */
  fetchedAt: string;
  /** True if served from cache. */
  cached: boolean;
  /** True if the cached data is older than 24h. */
  stale: boolean;
};

export function isValidGscDateRange(value: string): value is GscDateRangeKey {
  return (VALID_RANGES as readonly string[]).includes(value);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute [startDate, endDate] for a range, ending DATA_DELAY_DAYS ago. */
export function gscDateRange(range: GscDateRangeKey): { startDate: string; endDate: string } {
  const days = range === "7d" ? 7 : range === "28d" ? 28 : 90;
  const end = new Date();
  end.setDate(end.getDate() - DATA_DELAY_DAYS);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

type CacheRow = {
  data_json: string | Record<string, unknown>;
  fetched_at: Date;
};

async function readCache(
  siteUrl: string,
  dateRange: GscDateRangeKey,
): Promise<{ report: GscReport; fetchedAt: Date } | null> {
  const rows = await query<CacheRow>(
    `SELECT data_json, fetched_at FROM analytics_cache
     WHERE provider='search_console' AND property_id=$1 AND date_range=$2 AND report_type='overview'
     LIMIT 1`,
    [siteUrl, dateRange],
  );
  const row = rows.rows[0];
  if (!row) return null;
  const data = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
  return { report: data as GscReport, fetchedAt: new Date(row.fetched_at) };
}

async function writeCache(siteUrl: string, dateRange: GscDateRangeKey, report: GscReport): Promise<void> {
  const id = randomUUID();
  await query(
    `INSERT INTO analytics_cache(id, provider, property_id, date_range, report_type, data_json, fetched_at)
     VALUES($1, 'search_console', $2, $3, 'overview', $4, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE data_json=VALUES(data_json), fetched_at=CURRENT_TIMESTAMP(3)`,
    [id, siteUrl, dateRange, JSON.stringify(report)],
  );
  // Opportunistic purge of rows older than the 90-day retention policy.
  await query(
    `DELETE FROM analytics_cache WHERE fetched_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 90 DAY)`,
  ).catch(() => undefined);
}

/**
 * Validate that a site URL belongs to the connected Google account.
 * Returns the canonical siteUrl from Google's list. Throws when the site
 * is not accessible — the client can never inject an arbitrary property.
 */
export async function validateGscSite(accessToken: string, siteUrl: string): Promise<string> {
  const sites = await listGscSites(accessToken);
  const match = sites.find((s) => s.siteUrl === siteUrl);
  if (!match) throw new Error("Site is not available in Search Console for this account.");
  return match.siteUrl;
}

/**
 * Fetch the Search Console overview report for the owner's saved site.
 *
 * Flow: validate date range → get connection (site URL from DB) →
 * check cache → get valid access token (auto-refresh) → validate site
 * against Google's list → searchAnalytics queries (totals + top queries +
 * top pages) → map → cache → return.
 */
export async function getGscReport(actorId: string, dateRangeRaw: string): Promise<GscReport> {
  if (!isValidGscDateRange(dateRangeRaw)) {
    throw new Error(`Invalid date range. Use one of: ${VALID_RANGES.join(", ")}.`);
  }
  const dateRange = dateRangeRaw;

  const status = await getConnectionStatus("search_console", actorId);
  if (!status) throw new Error("Search Console is not connected.");
  const siteUrl = status.propertyId;
  if (!siteUrl) throw new Error("No Search Console site selected. Select a site first.");

  const cached = await readCache(siteUrl, dateRange);
  if (cached) {
    const ageMs = Date.now() - cached.fetchedAt.getTime();
    return {
      ...cached.report,
      fetchedAt: cached.fetchedAt.toISOString(),
      cached: true,
      stale: ageMs > CACHE_STALE_MS,
    };
  }

  const accessToken = await getValidAccessToken("search_console", actorId);
  // Re-validate the saved site against Google's current list (it may have
  // been removed or the permission revoked since it was saved).
  const validSite = await validateGscSite(accessToken, siteUrl);
  const { startDate, endDate } = gscDateRange(dateRange);

  // Totals: dimension-less query returns a single aggregated row.
  const [totalsRows, queryRows, pageRows] = await Promise.all([
    querySearchAnalytics(accessToken, validSite, { startDate, endDate, dimensions: [], rowLimit: 1 }),
    querySearchAnalytics(accessToken, validSite, { startDate, endDate, dimensions: ["query"], rowLimit: 10 }),
    querySearchAnalytics(accessToken, validSite, { startDate, endDate, dimensions: ["page"], rowLimit: 10 }),
  ]);

  const totals = totalsRows[0];
  const report: GscReport = {
    clicks: totals?.clicks ?? 0,
    impressions: totals?.impressions ?? 0,
    avgCtr: totals?.ctr ?? 0,
    avgPosition: totals?.position ?? 0,
    topQueries: queryRows.map((r) => ({
      query: r.keys[0] ?? "(unknown)",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    topPages: pageRows.map((r) => ({
      page: r.keys[0] ?? "(unknown)",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    dateRange,
    startDate,
    endDate,
    fetchedAt: new Date().toISOString(),
    cached: false,
    stale: false,
  };

  await writeCache(siteUrl, dateRange, report);
  return report;
}

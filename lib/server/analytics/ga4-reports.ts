import "server-only";
import { randomUUID } from "crypto";
import { getConnectionStatus, getValidAccessToken } from "./tokens";
import { query } from "@/lib/server/db";

/**
 * Phase 2 Feature 3 (Phase B+): GA4 metrics via Data API v1beta.
 *
 * Fetches real analytics metrics using the Google Analytics Data API
 * `runReport` endpoint. Only the `analytics.readonly` scope is used.
 *
 * Security:
 * - Requires a valid (possibly refreshed) access token; never exposes tokens.
 * - Property ID comes from the owner's DB record, never from the client.
 * - Date ranges are validated against an allowlist.
 * - Results are cached per (provider, property, date_range, report_type).
 * - API errors are mapped to safe, generic messages.
 * - Auth failures and transient errors are never cached.
 */

const DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

export type DateRangeKey = "7d" | "30d" | "90d";
const VALID_RANGES: readonly DateRangeKey[] = ["7d", "30d", "90d"];

/** Cache TTL: data older than this is considered stale (but still served with a badge). */
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;
/** Cache retention: rows older than this are purged (90-day policy). */
const CACHE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type TopPage = {
  pageTitle: string;
  pagePath: string;
  views: number;
};

export type GA4Report = {
  sessions: number;
  totalUsers: number;
  pageViews: number;
  topPages: TopPage[];
  dateRange: DateRangeKey;
  /** ISO timestamp of when the data was fetched (from cache or live). */
  fetchedAt: string;
  /** True if served from cache. */
  cached: boolean;
  /** True if the cached data is older than 24h. */
  stale: boolean;
};

type RunReportResponse = {
  rowCount?: number;
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  totals?: Array<{
    metricValues?: Array<{ value?: string }>;
  }>;
};

function assertValidDateRange(value: string): asserts value is DateRangeKey {
  if (!(VALID_RANGES as readonly string[]).includes(value)) {
    throw new Error(`Invalid date range. Use one of: ${VALID_RANGES.join(", ")}.`);
  }
}

function dateRangeToStartDate(range: DateRangeKey): string {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function parseIntSafe(value: string | undefined): number {
  const n = parseInt(value ?? "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Extract the three overview totals (sessions, totalUsers, screenPageViews)
 * from a dimension-less runReport response.
 *
 * The Data API only populates `totals[]` when `metricAggregations` is
 * requested; otherwise the values arrive in `rows[0].metricValues`.
 * Exported for tests.
 */
export function extractTotals(res: RunReportResponse): {
  sessions: number;
  totalUsers: number;
  pageViews: number;
} {
  const values =
    res.totals?.[0]?.metricValues ?? res.rows?.[0]?.metricValues ?? [];
  return {
    sessions: parseIntSafe(values[0]?.value),
    totalUsers: parseIntSafe(values[1]?.value),
    pageViews: parseIntSafe(values[2]?.value),
  };
}

async function callRunReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<RunReportResponse> {
  const url = `${DATA_API_BASE}/properties/${propertyId}:runReport`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Could not reach Google Analytics API.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Google authorization failed. Reconnect your account.");
  }
  if (response.status === 429) {
    throw new Error("Google API rate limit exceeded. Please try again later.");
  }
  if (!response.ok) {
    throw new Error("Could not fetch analytics report. Please try again.");
  }
  return (await response.json()) as RunReportResponse;
}

type CacheRow = {
  data_json: string | Record<string, unknown>;
  fetched_at: Date;
};

async function readCache(
  propertyId: string,
  dateRange: DateRangeKey,
): Promise<{ report: GA4Report; fetchedAt: Date } | null> {
  const rows = await query<CacheRow>(
    `SELECT data_json, fetched_at FROM analytics_cache
     WHERE provider='ga4' AND property_id=$1 AND date_range=$2 AND report_type='overview'
     LIMIT 1`,
    [propertyId, dateRange],
  );
  const row = rows.rows[0];
  if (!row) return null;
  const data = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
  return {
    report: data as GA4Report,
    fetchedAt: new Date(row.fetched_at),
  };
}

async function writeCache(
  propertyId: string,
  dateRange: DateRangeKey,
  report: GA4Report,
): Promise<void> {
  const id = randomUUID();
  const dataJson = JSON.stringify(report);
  await query(
    `INSERT INTO analytics_cache(id, provider, property_id, date_range, report_type, data_json, fetched_at)
     VALUES($1, 'ga4', $2, $3, 'overview', $4, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE data_json=VALUES(data_json), fetched_at=CURRENT_TIMESTAMP(3)`,
    [id, propertyId, dateRange, dataJson],
  );
  // Opportunistic purge of rows older than the 90-day retention policy.
  await query(
    `DELETE FROM analytics_cache WHERE fetched_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 90 DAY)`,
  ).catch(() => undefined);
}

/**
 * Fetch the GA4 overview report for the owner's saved property.
 *
 * Flow: validate date range → get connection (property ID from DB) →
 * check cache → get valid access token (auto-refresh) → Data API runReport
 * (totals + top pages) → map → cache → return.
 *
 * Throws safe errors for: not connected, no property selected, invalid range,
 * auth failures, rate limits, API errors. Auth failures and API errors are
 * never cached.
 */
export async function getOverviewReport(
  actorId: string,
  dateRangeRaw: string,
): Promise<GA4Report> {
  assertValidDateRange(dateRangeRaw);
  const dateRange = dateRangeRaw as DateRangeKey;

  // Property ID from the owner's DB record — never from the client.
  const status = await getConnectionStatus("ga4", actorId);
  if (!status) {
    throw new Error("Google Analytics is not connected.");
  }
  const propertyId = status.propertyId;
  if (!propertyId) {
    throw new Error("No GA4 property selected. Select a property first.");
  }

  // Cache check.
  const cached = await readCache(propertyId, dateRange);
  const now = Date.now();
  if (cached) {
    const ageMs = now - cached.fetchedAt.getTime();
    return {
      ...cached.report,
      fetchedAt: cached.fetchedAt.toISOString(),
      cached: true,
      stale: ageMs > CACHE_STALE_MS,
    };
  }

  // Live fetch. getValidAccessToken handles refresh transparently.
  const accessToken = await getValidAccessToken("ga4", actorId);
  const startDate = dateRangeToStartDate(dateRange);

  // Totals: sessions, totalUsers, screenPageViews.
  // Note: the Data API only populates `totals[]` when `metricAggregations`
  // is requested. For a dimension-less report the values come back in
  // `rows[0].metricValues`, so fall back to that when `totals` is empty.
  const totalsRes = await callRunReport(accessToken, propertyId, {
    dateRanges: [{ startDate, endDate: "today" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
  });
  const { sessions, totalUsers, pageViews } = extractTotals(totalsRes);

  // Top pages: pageTitle + pagePath dimensions, ordered by views desc, top 10.
  const pagesRes = await callRunReport(accessToken, propertyId, {
    dateRanges: [{ startDate, endDate: "today" }],
    dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 10,
  });
  const topPages: TopPage[] = (pagesRes.rows ?? []).map((row) => ({
    pageTitle: row.dimensionValues?.[0]?.value ?? "(unknown)",
    pagePath: row.dimensionValues?.[1]?.value ?? "/",
    views: parseIntSafe(row.metricValues?.[0]?.value),
  }));

  const report: GA4Report = {
    sessions,
    totalUsers,
    pageViews,
    topPages,
    dateRange,
    fetchedAt: new Date().toISOString(),
    cached: false,
    stale: false,
  };

  // Cache the successful report. Failures throw before this point and are
  // never cached.
  await writeCache(propertyId, dateRange, report);
  return report;
}

/** Test seam: validate a date range string without throwing the full flow. */
export function isValidDateRange(value: string): value is DateRangeKey {
  return (VALID_RANGES as readonly string[]).includes(value);
}

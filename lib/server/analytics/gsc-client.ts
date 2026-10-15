import "server-only";

/**
 * Phase 2 — Google Search Console API client (webmasters/v3).
 *
 * Server-side only. Uses the owner's stored OAuth access token with the
 * read-only `webmasters.readonly` scope. Tokens are never exposed.
 *
 * Endpoints:
 * - GET  /webmasters/v3/sites — list verified sites
 * - POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query — search analytics
 *
 * All network calls have timeouts. API errors are mapped to safe messages.
 */

const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";

export type GscSite = {
  siteUrl: string;
  permissionLevel: string;
};

export type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type SitesListResponse = {
  siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
};

type SearchAnalyticsResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
};

function safeApiError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error("Google authorization failed. Reconnect Search Console.");
  }
  if (status === 429) {
    return new Error("Google API rate limit exceeded. Please try again later.");
  }
  if (status === 404) {
    return new Error("Site not found in Search Console.");
  }
  return new Error("Could not fetch Search Console data. Please try again.");
}

async function gscFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${GSC_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Could not reach Google Search Console API.");
  }
  if (!response.ok) throw safeApiError(response.status);
  return response;
}

/**
 * List Search Console sites (properties) accessible to the connected account.
 * Only sites with at least siteOwner/siteFullUser/siteRestrictedUser permission
 * are useful; the raw permission level is returned for display.
 */
export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const response = await gscFetch(accessToken, "/sites");
  const data = (await response.json()) as SitesListResponse;
  return (data.siteEntry ?? [])
    .filter((e) => typeof e.siteUrl === "string" && e.siteUrl.length > 0)
    .map((e) => ({
      siteUrl: e.siteUrl as string,
      permissionLevel: e.permissionLevel ?? "unknown",
    }));
}

export type GscQueryOptions = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: Array<"query" | "page" | "device" | "country" | "date">;
  rowLimit?: number;
};

/**
 * Query search analytics for a site. The siteUrl is URL-encoded into the path
 * (it may contain :// and other special characters, e.g. sc-domain:example.com).
 */
export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  options: GscQueryOptions,
): Promise<GscRow[]> {
  const encoded = encodeURIComponent(siteUrl);
  const response = await gscFetch(accessToken, `/sites/${encoded}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: options.dimensions,
      rowLimit: options.rowLimit ?? 1000,
    }),
  });
  const data = (await response.json()) as SearchAnalyticsResponse;
  return (data.rows ?? []).map((r) => ({
    keys: r.keys ?? [],
    clicks: typeof r.clicks === "number" && r.clicks >= 0 ? r.clicks : 0,
    impressions: typeof r.impressions === "number" && r.impressions >= 0 ? r.impressions : 0,
    ctr: typeof r.ctr === "number" && r.ctr >= 0 ? r.ctr : 0,
    position: typeof r.position === "number" && r.position > 0 ? r.position : 0,
  }));
}

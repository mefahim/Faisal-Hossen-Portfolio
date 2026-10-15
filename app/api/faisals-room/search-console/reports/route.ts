import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getGscReport } from "@/lib/server/analytics/gsc-reports";
import { getConnectionStatus } from "@/lib/server/analytics/tokens";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase 2 — Search Console: search performance report.
 *
 * GET, owner-only. Returns real clicks, impressions, average CTR, average
 * position, top queries, and top pages for the owner's saved Search Console
 * site via the webmasters/v3 searchAnalytics API.
 *
 * Query params:
 * - dateRange: "7d" | "28d" | "90d" (default "28d")
 * - refresh: "1" to bypass the cache and fetch live data
 *
 * The site URL always comes from the owner's database record, never from
 * the client. Rate limited: 30 requests per 10 minutes per owner.
 */
export async function GET(request: Request) {
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
    }

    const rate = await consumeRateLimit(`gsc-reports:${owner.userId}`, 30, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const url = new URL(request.url);
    const dateRange = url.searchParams.get("dateRange") ?? "28d";
    const bypassCache = url.searchParams.get("refresh") === "1";

    if (bypassCache) {
      const { query } = await import("@/lib/server/db");
      const status = await getConnectionStatus("search_console", owner.userId);
      if (status?.propertyId) {
        await query(
          `DELETE FROM analytics_cache WHERE provider='search_console' AND property_id=$1 AND date_range=$2 AND report_type='overview'`,
          [status.propertyId, dateRange],
        ).catch(() => undefined);
      }
    }

    const report = await getGscReport(owner.userId, dateRange);
    return NextResponse.json({ report }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    const message = safeErrorMessage(error);
    const status =
      message.includes("not connected") || message.includes("No Search Console site")
        ? 409
        : message.includes("Invalid date range")
          ? 400
          : message.includes("authorization failed") || message.includes("Reconnect")
            ? 401
            : message.includes("rate limit")
              ? 429
              : 503;
    console.error(`[${requestId}] GSC report failed: ${message}`);
    return NextResponse.json({ error: message, requestId }, { status, headers: noStore });
  }
}

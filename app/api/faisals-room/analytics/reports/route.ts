import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getOverviewReport } from "@/lib/server/analytics/ga4-reports";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase B+ : GA4 metrics report.
 *
 * GET, owner-only. Returns real sessions, users, pageviews, and top pages
 * for the owner's saved GA4 property via the Data API v1beta runReport.
 *
 * Query params:
 * - dateRange: "7d" | "30d" | "90d" (default "30d")
 * - refresh: "1" to bypass the cache and fetch live data
 *
 * The property ID always comes from the owner's database record, never from
 * the client. Rate limited: 30 requests per 10 minutes per owner.
 */
export async function GET(request: Request) {
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
    }

    const rate = await consumeRateLimit(`ga4-reports:${owner.userId}`, 30, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const url = new URL(request.url);
    const dateRange = url.searchParams.get("dateRange") ?? "30d";
    const bypassCache = url.searchParams.get("refresh") === "1";

    // Bypass cache on explicit refresh: delete the cached row first so the
    // report is fetched live. (getOverviewReport checks cache internally.)
    if (bypassCache) {
      const { query } = await import("@/lib/server/db");
      const { getConnectionStatus } = await import("@/lib/server/analytics/tokens");
      const status = await getConnectionStatus("ga4", owner.userId);
      if (status?.propertyId) {
        await query(
          `DELETE FROM analytics_cache WHERE provider='ga4' AND property_id=$1 AND date_range=$2 AND report_type='overview'`,
          [status.propertyId, dateRange],
        ).catch(() => undefined);
      }
    }

    const report = await getOverviewReport(owner.userId, dateRange);
    return NextResponse.json({ report }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    const message = safeErrorMessage(error);
    // Map known safe messages to appropriate status codes.
    const status =
      message.includes("not connected") || message.includes("No GA4 property")
        ? 409
        : message.includes("Invalid date range")
          ? 400
          : message.includes("authorization failed") || message.includes("Reconnect")
            ? 401
            : message.includes("rate limit")
              ? 429
              : 503;
    console.error(`[${requestId}] GA4 report failed: ${message}`);
    return NextResponse.json({ error: message, requestId }, { status, headers: noStore });
  }
}

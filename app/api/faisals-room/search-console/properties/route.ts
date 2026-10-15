import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getValidAccessToken } from "@/lib/server/analytics/tokens";
import { listGscSites } from "@/lib/server/analytics/gsc-client";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase 2 — Search Console: list sites accessible to the connected account.
 *
 * GET, owner-only. Returns site URLs and permission levels (no tokens).
 * Rate limited: 30 requests per 10 minutes per owner.
 */
export async function GET(request: Request) {
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: noStore });
    }

    const rate = await consumeRateLimit(`gsc-sites:${owner.userId}`, 30, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const accessToken = await getValidAccessToken("search_console", owner.userId);
    const sites = await listGscSites(accessToken);
    return NextResponse.json({ sites }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    console.error(`[${requestId}] GSC site listing failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503, headers: noStore });
  }
}

import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { listGA4Properties } from "@/lib/server/analytics/ga4-properties";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase B Step 2 (PR-B): List GA4 properties accessible to the connected account.
 *
 * GET, owner-only. Returns property IDs and display names (no tokens, no metrics).
 * Rate limited: 30 requests per 10 minutes per owner.
 */
export async function GET(request: Request) {
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`ga4-props:${owner.userId}`, 30, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const properties = await listGA4Properties("ga4", owner.userId);
    return NextResponse.json({ properties }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    console.error(`[${requestId}] Property listing failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503, headers: noStore });
  }
}

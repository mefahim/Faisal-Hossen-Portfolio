import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { disconnectProvider } from "@/lib/server/analytics/tokens";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase 2 — Search Console: disconnect.
 *
 * POST, owner-only, same-origin CSRF protection. Revokes the token at Google
 * (best-effort) and always deletes local credentials and cached reports.
 * Rate limited. Independent from the GA4 connection.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`gsc-disconnect:${owner.userId}`, 10, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    await disconnectProvider("search_console", owner.userId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    console.error(`[${requestId}] GSC disconnect failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: "Could not disconnect.", requestId }, { status: 503, headers: noStore });
  }
}

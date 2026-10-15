import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { disconnectProvider } from "@/lib/server/analytics/tokens";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase B Step 2 (PR-C): Disconnect the GA4 provider.
 *
 * POST, owner-only, same-origin CSRF protection. Revokes the token at Google
 * (best-effort) and always deletes local credentials. Rate limited.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`ga4-disconnect:${owner.userId}`, 10, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    await disconnectProvider("ga4", owner.userId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    console.error(`[${requestId}] Disconnect failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: "Could not disconnect.", requestId }, { status: 503, headers: noStore });
  }
}

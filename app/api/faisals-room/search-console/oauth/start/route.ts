import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { buildAuthorizationUrl, OAuthConfigError } from "@/lib/server/analytics/google-oauth";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase 2 — Search Console: initiate the Google OAuth flow.
 *
 * POST only, owner-only, same-origin CSRF protection. Requests the
 * read-only `webmasters.readonly` scope (independent from the GA4
 * connection). Rate limited: 10 initiations per 10 minutes per owner.
 *
 * The shared callback (`/api/faisals-room/analytics/oauth/callback`)
 * discovers the provider from the persisted state token.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`gsc-oauth-start:${owner.userId}`, 10, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many OAuth attempts. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const { url } = await buildAuthorizationUrl("search_console", owner.userId);
    return NextResponse.json({ url }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    if (error instanceof OAuthConfigError) {
      console.error(`[${requestId}] GSC OAuth start misconfigured: ${safeErrorMessage(error)}`);
      return NextResponse.json(
        { error: "Google OAuth is not configured. Contact the site owner.", requestId },
        { status: 503, headers: noStore },
      );
    }
    console.error(`[${requestId}] GSC OAuth start failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: "Could not start Google OAuth.", requestId }, { status: 503, headers: noStore });
  }
}

import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { buildAuthorizationUrl, OAuthConfigError } from "@/lib/server/analytics/google-oauth";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase B Step 2 (PR-A): Initiate the Google OAuth flow.
 *
 * POST only. Requires:
 * - Owner session (requireOwner)
 * - Same-origin request (CSRF protection via sameOrigin)
 * - Rate limit: 10 initiations per 10 minutes per owner
 *
 * Returns the Google authorization URL; the client redirects the browser.
 * The state token (CSRF protection for the callback) is persisted server-side.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`oauth-start:${owner.userId}`, 10, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many OAuth attempts. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const { url } = await buildAuthorizationUrl("ga4", owner.userId);
    return NextResponse.json({ url }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    if (error instanceof OAuthConfigError) {
      // Configuration problem, not a user error. No secrets in the message.
      console.error(`[${requestId}] OAuth start misconfigured: ${safeErrorMessage(error)}`);
      return NextResponse.json(
        { error: "Google OAuth is not configured. Contact the site owner.", requestId },
        { status: 503, headers: noStore },
      );
    }
    console.error(`[${requestId}] OAuth start failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: "Could not start Google OAuth.", requestId }, { status: 503, headers: noStore });
  }
}

import { NextResponse } from "next/server";
import { consumeOAuthState } from "@/lib/server/analytics/oauth-state";
import { exchangeCodeForTokens, getOAuthConfig, OAuthConfigError } from "@/lib/server/analytics/google-oauth";
import "@/lib/server/analytics/register-google-oauth";
import { storeTokens } from "@/lib/server/analytics/tokens";
import { correlationId, safeErrorMessage } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase B Step 2 (PR-A): Google OAuth callback.
 *
 * This route is intentionally PUBLIC (no owner session required): the
 * single-use state token is the CSRF protection and authentication for this
 * request. Requiring a session here would break the flow (Google redirects
 * the browser, which may not send the session cookie in all cases) and is
 * unnecessary because the state is unguessable and single-use.
 *
 * Security:
 * - Rate limited (public endpoint): 20 callbacks per 10 minutes per IP.
 * - State is validated and consumed atomically before any token exchange.
 * - Authorization codes and tokens are never logged.
 * - Google's `error` parameter (e.g. access_denied) is handled gracefully.
 * - Token exchange failures never leave partial state.
 */

function dashboardUrl(request: Request, params: URLSearchParams): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin;
  return `${siteUrl}/faisals-room/analytics?${params.toString()}`;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function GET(request: Request) {
  const requestId = correlationId(request);
  const url = new URL(request.url);

  // Rate limit the public callback to prevent abuse and log spam.
  const rate = await consumeRateLimit(`oauth-callback:${clientIp(request)}`, 20, 600).catch(() => ({
    allowed: true,
    retrySeconds: 0,
  }));
  if (!rate.allowed) {
    return NextResponse.redirect(dashboardUrl(request, new URLSearchParams({ oauth: "rate_limited" })), {
      headers: noStore,
    });
  }

  const error = url.searchParams.get("error");
  if (error) {
    // User denied consent or Google returned an error. Never reflect the raw
    // error_description (it may contain sensitive context).
    const safeCode = error === "access_denied" ? "denied" : "provider_error";
    return NextResponse.redirect(dashboardUrl(request, new URLSearchParams({ oauth: safeCode })), {
      headers: noStore,
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(dashboardUrl(request, new URLSearchParams({ oauth: "invalid_request" })), {
      headers: noStore,
    });
  }

  try {
    const config = getOAuthConfig();

    // Atomic single-use consumption. Throws on unknown/expired/reused/mismatched state.
    // The returned ownerId identifies who initiated the flow — no live owner
    // session is required, so tokens are stored even if the session expired
    // while the owner was on Google's authorization pages. The unguessable,
    // single-use state token is the authentication for this callback.
    const { verifier: codeVerifier, ownerId } = await consumeOAuthState(state, "ga4");
    if (!ownerId) {
      // Legacy states (created before owner tracking) cannot be attributed.
      console.error(`[${requestId}] OAuth callback completed but state has no owner; tokens discarded.`);
      return NextResponse.redirect(dashboardUrl(request, new URLSearchParams({ oauth: "session_expired" })), {
        headers: noStore,
      });
    }

    // Exchange the authorization code. The code is single-use at Google too.
    const tokens = await exchangeCodeForTokens(code, codeVerifier, config.redirectUri);

    // Persist encrypted tokens, attributed to the owner who initiated the flow.
    await storeTokens("ga4", tokens, ownerId, undefined, { isRefresh: false });

    return NextResponse.redirect(dashboardUrl(request, new URLSearchParams({ oauth: "connected" })), {
      headers: noStore,
    });
  } catch (err) {
    // Never log the code, state, or tokens. safeErrorMessage strips details.
    console.error(`[${requestId}] OAuth callback failed: ${safeErrorMessage(err)}`);
    const params = new URLSearchParams({
      oauth: err instanceof OAuthConfigError ? "misconfigured" : "failed",
    });
    return NextResponse.redirect(dashboardUrl(request, params), { headers: noStore });
  }
}

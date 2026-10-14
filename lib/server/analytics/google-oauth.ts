import "server-only";
import { createOAuthChallenge } from "./oauth-state";
import type { TokenSet } from "./tokens";

/**
 * Phase 2 Feature 3 (Phase B Step 2, PR-A): Real Google OAuth2 implementation.
 *
 * This module implements the Google-specific OAuth2 authorization-code flow
 * with PKCE (RFC 7636, S256). It is the concrete implementation behind the
 * injectable `TokenExchangeFn` / `TokenRefreshFn` in `tokens.ts`.
 *
 * Security properties:
 * - Only the `analytics.readonly` scope is requested. No write scopes.
 * - `access_type=offline` + `prompt=consent` ensure a refresh token is issued.
 * - The redirect URI must exactly match the URI registered in Google Cloud
 *   Console; it is derived from NEXT_PUBLIC_SITE_URL (fail closed if unset).
 * - Authorization codes, tokens, and client secrets are never logged.
 * - All network calls have timeouts (AbortSignal.timeout).
 * - Token responses are strictly validated before use.
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GA4_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const OAUTH_CALLBACK_PATH = "/api/faisals-room/analytics/oauth/callback";

/** Error thrown when OAuth configuration is missing or invalid. Fails closed. */
export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthConfigError";
  }
}

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Resolve and validate Google OAuth configuration from the environment.
 * Throws OAuthConfigError when anything is missing. Never logs secrets.
 */
export function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!clientId) {
    throw new OAuthConfigError("Google OAuth is not configured (missing client ID).");
  }
  if (!clientSecret) {
    throw new OAuthConfigError("Google OAuth is not configured (missing client secret).");
  }
  if (!siteUrl) {
    throw new OAuthConfigError("Google OAuth is not configured (missing site URL).");
  }
  // Normalize: no trailing slash, so the redirect URI is deterministic and
  // matches exactly what is registered in Google Cloud Console.
  const redirectUri = `${siteUrl.replace(/\/+$/, "")}${OAUTH_CALLBACK_PATH}`;
  return { clientId, clientSecret, redirectUri };
}

export type AuthorizationRequest = {
  /** URL to redirect the browser to (Google's authorization page). */
  url: string;
};

/**
 * Create a fresh OAuth challenge, persist the state, and build the Google
 * authorization URL. The caller redirects the browser to `url`.
 *
 * The state token is the CSRF protection for the callback; the PKCE verifier
 * is encrypted at rest and never exposed. The ownerId records who initiated
 * the flow for token attribution (session-resilient).
 */
export async function buildAuthorizationUrl(provider: string, ownerId?: string): Promise<AuthorizationRequest> {
  const config = getOAuthConfig();
  const { state, codeChallenge } = await createOAuthChallenge(provider, ownerId);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GA4_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
}

type GoogleTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
};

/**
 * Validate a Google token endpoint response. Returns a TokenSet on success.
 * Throws on missing/invalid fields. Never logs token material.
 */
export function parseTokenResponse(data: GoogleTokenResponse): TokenSet {
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Token exchange failed: missing access token.");
  }
  if (typeof data.refresh_token !== "string" || !data.refresh_token) {
    // Google only returns a refresh token on first consent (or with
    // prompt=consent). Without it, offline access is impossible.
    throw new Error("Token exchange failed: no refresh token issued. Reconnect and grant offline access.");
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/**
 * Exchange an authorization code for tokens (with PKCE verifier).
 * Implements TokenExchangeFn for registration in tokens.ts.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenSet> {
  const config = getOAuthConfig();
  // The redirect URI must match the one used in the authorization request.
  if (redirectUri !== config.redirectUri) {
    throw new OAuthConfigError("OAuth redirect URI mismatch.");
  }
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Token exchange failed: could not reach Google.");
  }
  if (!response.ok) {
    // Never include the response body: it may contain error details but must
    // not leak into logs alongside the code/token context.
    throw new Error("Token exchange failed: Google rejected the request.");
  }
  const data = (await response.json()) as GoogleTokenResponse;
  return parseTokenResponse(data);
}

/**
 * Refresh an access token using a refresh token.
 * Implements TokenRefreshFn for registration in tokens.ts.
 * Google may rotate the refresh token; the caller persists whatever is returned.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const config = getOAuthConfig();
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Token refresh failed: could not reach Google.");
  }
  if (!response.ok) {
    throw new Error("Token refresh failed: Google rejected the request.");
  }
  const data = (await response.json()) as GoogleTokenResponse;
  // Refresh responses may omit refresh_token (rotation is optional). If absent,
  // keep using the existing refresh token — the caller handles persistence.
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Token refresh failed: missing access token.");
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken: data.access_token,
    // Preserve the current refresh token unless Google rotated it.
    refreshToken: typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

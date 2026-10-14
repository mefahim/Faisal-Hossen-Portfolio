import "server-only";
import { randomUUID } from "node:crypto";
import { requireOwner, UnauthorizedError } from "../auth";
import { transaction, query } from "../db";
import { encryptToken, decryptToken, isEncryptionAvailable } from "./encryption";

/**
 * Phase 2 Feature 3 (Phase A): OAuth token lifecycle skeleton.
 *
 * This module defines the token storage, retrieval, refresh, and disconnect
 * logic. Network calls to Google are abstracted behind injectable functions
 * so unit tests can mock them. Phase A does NOT make real Google API calls.
 *
 * Security:
 * - Tokens are encrypted with AES-256-GCM before storage.
 * - All functions require owner authentication.
 * - Token refresh is automatic when expiry is within 5 minutes.
 * - Disconnect deletes all token material (no soft-delete for secrets).
 */

export const GA4_PROVIDER = "ga4";
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry
export const SUPPORTED_PROVIDERS = ["ga4", "search_console"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/** Pure validation: is this a supported provider? (testable without DB) */
export function assertSupportedProvider(provider: string): asserts provider is SupportedProvider {
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Pure validation: normalize and validate a GA4 property ID. (testable without DB) */
export function normalizePropertyId(propertyId: string): string {
  if (!/^(\d+|properties\/\d+)$/.test(propertyId)) {
    throw new Error("Invalid GA4 property ID format.");
  }
  return propertyId.startsWith("properties/") ? propertyId.slice("properties/".length) : propertyId;
}

/** Pure logic: does this token need refresh? (testable without DB) */
export function needsRefresh(tokenExpiry: Date, now: Date = new Date()): boolean {
  return tokenExpiry.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER_MS;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type StoredTokenInfo = {
  provider: string;
  propertyId: string | null;
  connectedAt: string;
  tokenExpiry: string;
  // Note: tokens themselves are NEVER returned.
};

// Injectable network layer (mocked in tests; real implementation in Phase B).
export type TokenExchangeFn = (code: string, codeVerifier: string, redirectUri: string) => Promise<TokenSet>;
export type TokenRefreshFn = (refreshToken: string) => Promise<TokenSet>;

let exchangeImpl: TokenExchangeFn | null = null;
let refreshImpl: TokenRefreshFn | null = null;

/** Phase B will register the real Google token exchange implementation. */
export function _setTokenExchange(fn: TokenExchangeFn | null): void {
  exchangeImpl = fn;
}

/** Phase B will register the real Google token refresh implementation. */
export function _setTokenRefresh(fn: TokenRefreshFn | null): void {
  refreshImpl = fn;
}

function requireEncryption(): void {
  if (!isEncryptionAvailable()) {
    throw new Error("Token encryption is not configured. Provider integrations are disabled.");
  }
}

/** Pure function: build the upsert SQL for token storage. (testable without DB) */
export function buildStoreTokensSql(isRefresh: boolean): string {
  return (
    `INSERT INTO provider_tokens(id, provider, encrypted_access_token, encrypted_refresh_token, token_expiry, property_id, connected_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON DUPLICATE KEY UPDATE
       encrypted_access_token=VALUES(encrypted_access_token),
       encrypted_refresh_token=VALUES(encrypted_refresh_token),
       token_expiry=VALUES(token_expiry),
       property_id=VALUES(property_id),
       connected_by=VALUES(connected_by)` +
    (isRefresh
      ? `,
       last_refresh_at=CURRENT_TIMESTAMP(3)`
      : `,
       connected_at=CURRENT_TIMESTAMP(3),
       last_refresh_at=NULL`)
  );
}

export async function storeTokens(
  provider: string,
  tokens: TokenSet,
  actorId: string,
  propertyId?: string,
  options?: { isRefresh?: boolean },
): Promise<void> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  requireEncryption();
  assertSupportedProvider(provider);
  const encAccess = encryptToken(tokens.accessToken);
  const encRefresh = encryptToken(tokens.refreshToken);
  const isRefresh = options?.isRefresh === true;
  await transaction(async (client) => {
    // Upsert: one row per provider.
    // - Initial connection (isRefresh=false): set connected_at=now, last_refresh_at=NULL.
    // - Token refresh (isRefresh=true): preserve original connected_at, set last_refresh_at=now.
    await client.query(buildStoreTokensSql(isRefresh), [
      randomUUID(),
      provider,
      encAccess,
      encRefresh,
      tokens.expiresAt,
      propertyId ?? null,
      actorId,
    ]);
  });
}

/**
 * Get a valid access token, refreshing if near expiry.
 * Returns the DECRYPTED access token — caller must never expose it.
 */
export async function getValidAccessToken(provider: string, actorId: string): Promise<string> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  requireEncryption();
  const row = (
    await query<{
      encrypted_access_token: string | Buffer;
      encrypted_refresh_token: string | Buffer;
      token_expiry: Date;
    }>("SELECT encrypted_access_token, encrypted_refresh_token, token_expiry FROM provider_tokens WHERE provider=$1", [provider])
  ).rows[0];
  if (!row) throw new Error(`Provider '${provider}' is not connected.`);
  const toString = (v: string | Buffer): string => (typeof v === "string" ? v : v.toString("utf8"));
  // Refresh if expiring within buffer window.
  if (needsRefresh(row.token_expiry)) {
    if (!refreshImpl) {
      throw new Error("Token refresh is not implemented in Phase A. Reconnect the provider.");
    }
    const refreshToken = decryptToken(toString(row.encrypted_refresh_token));
    const fresh = await refreshImpl(refreshToken);
    await storeTokens(provider, fresh, actorId, undefined, { isRefresh: true });
    return fresh.accessToken;
  }
  return decryptToken(toString(row.encrypted_access_token));
}

export async function getConnectionStatus(provider: string): Promise<StoredTokenInfo | null> {
  const session = await requireOwner();
  void session;
  const row = (
    await query<{
      provider: string;
      property_id: string | null;
      connected_at: Date;
      token_expiry: Date;
    }>("SELECT provider, property_id, connected_at, token_expiry FROM provider_tokens WHERE provider=$1", [provider])
  ).rows[0];
  if (!row) return null;
  // Never return tokens. Only metadata.
  return {
    provider: row.provider,
    propertyId: row.property_id,
    connectedAt: row.connected_at.toISOString(),
    tokenExpiry: row.token_expiry.toISOString(),
  };
}

export async function disconnectProvider(provider: string, actorId: string): Promise<void> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  // Hard delete: no soft-delete for secrets. Cache entries are also purged.
  await transaction(async (client) => {
    await client.query("DELETE FROM provider_tokens WHERE provider=$1", [provider]);
    await client.query("DELETE FROM analytics_cache WHERE provider=$1", [provider]);
  });
}

export async function setPropertyId(provider: string, propertyId: string, actorId: string): Promise<void> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  const normalized = normalizePropertyId(propertyId);
  const result = await query("UPDATE provider_tokens SET property_id=$1 WHERE provider=$2", [normalized, provider]);
  if (result.rowCount === 0) throw new Error(`Provider '${provider}' is not connected.`);
}

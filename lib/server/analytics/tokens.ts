import "server-only";
import { randomUUID } from "node:crypto";
import { requireOwner, UnauthorizedError } from "../auth";
import { query, transaction, transactionWithConnectionControl, type DbClient } from "../db";
import { decryptToken, encryptToken, isEncryptionAvailable } from "./encryption";

/**
 * Phase 2 Feature 3 (Phase B Step 1): OAuth token lifecycle.
 *
 * This module defines the token storage, retrieval, refresh, and disconnect
 * logic. Network calls to Google are abstracted behind injectable functions
 * so unit tests can mock them. This step does NOT make real Google API calls.
 *
 * Security:
 * - Tokens are encrypted with AES-256-GCM before storage.
 * - All functions require owner authentication (except where noted).
 * - Token refresh is automatic when expiry is within 5 minutes.
 * - Concurrent refreshes are coordinated with a database-backed lock
 *   (MySQL GET_LOCK), so two requests cannot independently refresh the same
 *   provider token.
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

/**
 * Validate a Search Console site URL for storage. GSC site URLs are either
 * full URLs (https://example.com/) or domain properties (sc-domain:example.com).
 * The route additionally validates the site against Google's live site list;
 * this is the format-level guard. Exported for tests.
 */
export function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim();
  if (!trimmed || trimmed.length > 64) {
    throw new Error("Invalid Search Console site URL.");
  }
  if (!/^(https?:\/\/|sc-domain:)/i.test(trimmed)) {
    throw new Error("Invalid Search Console site URL.");
  }
  return trimmed;
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
export type TokenRevokerFn = (refreshToken: string) => Promise<void>;

let exchangeImpl: TokenExchangeFn | null = null;
let refreshImpl: TokenRefreshFn | null = null;
/**
 * L1: revoker override. `undefined` (default) means "use the real server-side
 * revocation"; `null` disables revocation; a function overrides it (tests).
 */
let revokerImpl: TokenRevokerFn | null | undefined = undefined;

/** Phase B will register the real Google token exchange implementation. */
export function _setTokenExchange(fn: TokenExchangeFn | null): void {
  exchangeImpl = fn;
}

/** Phase B will register the real Google token refresh implementation. */
export function _setTokenRefresh(fn: TokenRefreshFn | null): void {
  refreshImpl = fn;
}

/** Phase B will register the real Google token revocation implementation. */
export function _setTokenRevoker(fn: TokenRevokerFn | null): void {
  revokerImpl = fn;
}

/** Test-only: restore default revoker resolution (real implementation). */
export function _clearTokenRevoker(): void {
  revokerImpl = undefined;
}

/** Resolve the effective revoker: override, disabled, or real implementation. */
export function _resolveRevoker(): TokenRevokerFn | null {
  if (revokerImpl !== undefined) return revokerImpl;
  return revokeGoogleToken;
}

/**
 * Revoke a refresh token at Google. Server-side only; never called from the
 * browser. Phase B wires this into disconnectProvider via _setTokenRevoker.
 * Throws on network failure or non-OK response; callers treat revocation as
 * best-effort (local deletion always proceeds).
 */
export async function revokeGoogleToken(refreshToken: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Token revocation failed with status ${response.status}.`);
  }
}

function requireEncryption(): void {
  if (!isEncryptionAvailable()) {
    throw new Error("Token encryption is not configured. Provider integrations are disabled.");
  }
}

/**
 * Test seam: override owner session resolution for integration tests.
 * When set, analytics functions use this instead of requireOwner().
 * NEVER set in production code; tests must clear it after use.
 */
type SessionOverride = { userId: string } | null | "use-requireOwner";
let sessionOverride: SessionOverride = "use-requireOwner";

/** Test-only: force a specific owner session (or null for unauthenticated). */
export function _setSessionOverride(session: { userId: string } | null): void {
  sessionOverride = session;
}

/** Test-only: restore normal requireOwner() behavior. */
export function _clearSessionOverride(): void {
  sessionOverride = "use-requireOwner";
}

async function resolveSession(): Promise<{ userId: string }> {
  if (sessionOverride !== "use-requireOwner") {
    if (!sessionOverride) throw new UnauthorizedError();
    return sessionOverride;
  }
  return requireOwner();
}

/**
 * H1: cross-process mutex for token refresh.
 *
 * Uses MySQL GET_LOCK(), which is connection-scoped. Callers MUST invoke
 * acquire/release on the same connection — in practice, inside a single
 * transaction() callback. The lock is always released in a finally block;
 * relying on connection close is unsafe because pooled connections are reused.
 *
 * Database assumptions (documented):
 * - MySQL 5.7+ / MariaDB 10+: GET_LOCK(name, timeout) returns 1 on success,
 *   0 on timeout, NULL on error.
 * - Lock names are namespaced to avoid collisions with other applications
 *   sharing the database server.
 * - The refresh network call happens while holding the lock; the registered
 *   refresh implementation must have its own timeout (Phase B uses fetch
 *   with AbortSignal.timeout).
 */
export const REFRESH_LOCK_TIMEOUT_S = 10;

export function refreshLockName(provider: string): string {
  return `faisals_room:analytics:refresh:${provider}`;
}

async function acquireRefreshLock(client: DbClient, provider: string): Promise<boolean> {
  const result = await client.query<{ acquired: number | null }>("SELECT GET_LOCK($1, $2) AS acquired", [
    refreshLockName(provider),
    REFRESH_LOCK_TIMEOUT_S,
  ]);
  return result.rows[0]?.acquired === 1;
}

async function releaseRefreshLock(client: DbClient, provider: string): Promise<boolean> {
  try {
    const result = await client.query<{ released: number | null }>("SELECT RELEASE_LOCK($1) AS released", [
      refreshLockName(provider),
    ]);
    return result.rows[0]?.released === 1;
  } catch {
    return false;
  }
}

type PersistTokensInput = {
  provider: string;
  encryptedAccess: string;
  encryptedRefresh: string;
  expiresAt: Date;
  propertyId: string | null;
  actorId: string;
  isRefresh: boolean;
};

/** Low-level token persistence on an existing client (used inside transactions). */
async function persistTokens(client: DbClient, input: PersistTokensInput): Promise<void> {
  await client.query(buildStoreTokensSql(input.isRefresh), [
    randomUUID(),
    input.provider,
    input.encryptedAccess,
    input.encryptedRefresh,
    input.expiresAt,
    input.propertyId,
    input.actorId,
  ]);
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
  options?: { isRefresh?: boolean; skipSessionCheck?: boolean },
): Promise<void> {
  // Session check: normally the caller must have a live owner session matching
  // actorId. The OAuth callback skips this because there may be no live session
  // (expired during the Google flow) — authorization comes from the unguessable
  // single-use state token consumed before this call, which binds actorId to
  // the flow initiator.
  if (!options?.skipSessionCheck) {
    const session = await resolveSession();
    if (session.userId !== actorId) throw new UnauthorizedError();
  }
  requireEncryption();
  assertSupportedProvider(provider);
  const encAccess = encryptToken(tokens.accessToken);
  const encRefresh = encryptToken(tokens.refreshToken);
  const isRefresh = options?.isRefresh === true;
  await transaction(async (client) => {
    // Upsert: one row per provider.
    // - Initial connection (isRefresh=false): set connected_at=now, last_refresh_at=NULL.
    // - Token refresh (isRefresh=true): preserve original connected_at, set last_refresh_at=now.
    await persistTokens(client, {
      provider,
      encryptedAccess: encAccess,
      encryptedRefresh: encRefresh,
      expiresAt: tokens.expiresAt,
      propertyId: propertyId ?? null,
      actorId,
      isRefresh,
    });
  });
}

type TokenRow = {
  encrypted_access_token: string | Buffer;
  encrypted_refresh_token: string | Buffer;
  token_expiry: Date;
  property_id: string | null;
};

function tokenToString(v: string | Buffer): string {
  return typeof v === "string" ? v : v.toString("utf8");
}

/**
 * Get a valid access token, refreshing if near expiry.
 * Returns the DECRYPTED access token — caller must never expose it.
 *
 * H1: refresh is coordinated with a database-backed lock. The fast path
 * (token still valid) takes no lock. When a refresh is needed:
 *  1. Acquire the provider refresh lock (GET_LOCK, cross-process).
 *  2. Re-read the token row — another request may have refreshed it already.
 *  3. Only refresh if still needed; store the new tokens while holding the lock.
 * This prevents double refresh even with concurrent requests across app instances.
 */
export async function getValidAccessToken(provider: string, actorId: string): Promise<string> {
  const session = await resolveSession();
  if (session.userId !== actorId) throw new UnauthorizedError();
  requireEncryption();
  assertSupportedProvider(provider);
  const row = (
    await query<TokenRow>(
      "SELECT encrypted_access_token, encrypted_refresh_token, token_expiry, property_id FROM provider_tokens WHERE provider=$1",
      [provider],
    )
  ).rows[0];
  if (!row) throw new Error(`Provider '${provider}' is not connected.`);
  // Fast path: token still valid, no coordination needed.
  if (!needsRefresh(row.token_expiry)) {
    return decryptToken(tokenToString(row.encrypted_access_token));
  }
  // Slow path: coordinated refresh under a cross-process lock.
  // Uses transactionWithConnectionControl so a failed lock release destroys
  // the connection instead of returning a potentially lock-holding connection
  // to the pool.
  return transactionWithConnectionControl(async (client, control) => {
    const locked = await acquireRefreshLock(client, provider);
    if (!locked) {
      throw new Error("Could not acquire token refresh lock. Please retry.");
    }
    try {
      // Re-read after acquiring the lock: another request may have refreshed already.
      const current = (
        await client.query<TokenRow>(
          "SELECT encrypted_access_token, encrypted_refresh_token, token_expiry, property_id FROM provider_tokens WHERE provider=$1",
          [provider],
        )
      ).rows[0];
      if (!current) throw new Error(`Provider '${provider}' is not connected.`);
      if (!needsRefresh(current.token_expiry)) {
        return decryptToken(tokenToString(current.encrypted_access_token));
      }
      if (!refreshImpl) {
        throw new Error("Token refresh is not implemented. Reconnect the provider.");
      }
      const refreshToken = decryptToken(tokenToString(current.encrypted_refresh_token));
      const fresh = await refreshImpl(refreshToken);
      await persistTokens(client, {
        provider,
        encryptedAccess: encryptToken(fresh.accessToken),
        encryptedRefresh: encryptToken(fresh.refreshToken),
        expiresAt: fresh.expiresAt,
        propertyId: current.property_id,
        actorId,
        isRefresh: true,
      });
      return fresh.accessToken;
    } finally {
      // If the lock cannot be released, the connection may still hold it.
      // Destroy the connection so the leaked lock cannot block the pool.
      const released = await releaseRefreshLock(client, provider);
      if (!released) control.destroyConnection = true;
    }
  });
}

export async function getConnectionStatus(provider: string, actorId: string): Promise<StoredTokenInfo | null> {
  const session = await resolveSession();
  if (session.userId !== actorId) throw new UnauthorizedError();
  assertSupportedProvider(provider);
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
  const session = await resolveSession();
  if (session.userId !== actorId) throw new UnauthorizedError();
  assertSupportedProvider(provider);

  // L1: best-effort server-side revocation BEFORE local deletion.
  // Revocation needs the encryption key (to decrypt the refresh token); if the
  // key is missing, revocation is skipped but local deletion still proceeds.
  // Revocation failure must never skip local deletion; no token material is logged.
  const revoker = _resolveRevoker();
  if (revoker && isEncryptionAvailable()) {
    const existing = (
      await query<{ encrypted_refresh_token: string | Buffer }>(
        "SELECT encrypted_refresh_token FROM provider_tokens WHERE provider=$1",
        [provider],
      )
    ).rows[0];
    if (existing) {
      try {
        const refreshToken = decryptToken(tokenToString(existing.encrypted_refresh_token));
        await revoker(refreshToken);
      } catch {
        // Best-effort only: local deletion proceeds regardless.
        // Intentionally no details logged (must never leak token material).
      }
    }
  }

  // Hard delete: no soft-delete for secrets. Cache entries are also purged.
  await transaction(async (client) => {
    await client.query("DELETE FROM provider_tokens WHERE provider=$1", [provider]);
    await client.query("DELETE FROM analytics_cache WHERE provider=$1", [provider]);
  });
}

export async function setPropertyId(provider: string, propertyId: string, actorId: string): Promise<void> {
  const session = await resolveSession();
  if (session.userId !== actorId) throw new UnauthorizedError();
  assertSupportedProvider(provider);
  const normalized = provider === "search_console" ? normalizeSiteUrl(propertyId) : normalizePropertyId(propertyId);
  const result = await query("UPDATE provider_tokens SET property_id=$1 WHERE provider=$2", [normalized, provider]);
  if (result.rowCount === 0) throw new Error(`Provider '${provider}' is not connected.`);
}

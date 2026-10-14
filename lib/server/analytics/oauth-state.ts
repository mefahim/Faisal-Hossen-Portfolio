import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { query, transaction } from "../db";
import { decryptToken, encryptToken, isEncryptionAvailable } from "./encryption";
import { assertSupportedProvider } from "./tokens";

/**
 * Phase 2 Feature 3 (Phase B Step 1): OAuth2 state and PKCE utilities.
 *
 * Security properties:
 * - State tokens are cryptographically random (256-bit), single-use, and
 *   short-lived (10 minutes). They prevent CSRF on the OAuth callback.
 * - PKCE (RFC 7636, S256) prevents authorization code interception.
 * - State is persisted in the `oauth_states` table (see
 *   db/migrations/0004_oauth_states.sql) so flows survive process restarts
 *   and work across multiple app instances.
 * - Consumption is atomic: SELECT ... FOR UPDATE + DELETE inside a
 *   transaction. Concurrent callbacks for the same state serialize; only the
 *   first succeeds, the rest see "invalid or expired".
 * - The PKCE verifier is encrypted with AES-256-GCM before storage and is
 *   never exposed to the browser or logs.
 *
 * Authorization notes:
 * - `createOAuthChallenge` must only be called from owner-authenticated routes
 *   (the dashboard "Connect" action). It intentionally does not call
 *   requireOwner() itself so the storage layer stays decoupled; the route
 *   enforces it.
 * - `consumeOAuthState` is intentionally callable without an owner session:
 *   it runs on the public OAuth callback, where the single-use state token
 *   itself is the CSRF protection.
 */

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type OAuthChallenge = {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
};

/** Pure: generate state token + PKCE verifier/challenge. No I/O. */
export function generateChallengeParts(): { state: string; codeVerifier: string; codeChallenge: string } {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

function requireStateEncryption(): void {
  if (!isEncryptionAvailable()) {
    throw new Error("Token encryption is not configured. OAuth flows are disabled.");
  }
}

/**
 * Create and persist a fresh OAuth challenge.
 * The PKCE verifier is encrypted before storage. Expired states are purged
 * opportunistically (best-effort; creation never fails because of cleanup).
 */
export async function createOAuthChallenge(provider: string): Promise<OAuthChallenge> {
  assertSupportedProvider(provider);
  requireStateEncryption();
  const { state, codeVerifier, codeChallenge } = generateChallengeParts();
  const encryptedVerifier = encryptToken(codeVerifier);
  await query(
    `INSERT INTO oauth_states(state, provider, encrypted_verifier, expires_at)
     VALUES($1, $2, $3, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE))`,
    [state, provider, encryptedVerifier],
  );
  // Opportunistic cleanup of expired states. Best-effort only.
  await query("DELETE FROM oauth_states WHERE expires_at <= CURRENT_TIMESTAMP(3)").catch(() => undefined);
  return { state, codeVerifier, codeChallenge };
}

type StateRow = {
  provider: string;
  encrypted_verifier: string | Buffer;
};

/**
 * Atomically validate and consume a state token. Returns the decrypted PKCE
 * verifier on success. Throws on unknown, expired, reused, or
 * provider-mismatched state.
 *
 * Single-use is enforced by the database: the row is locked (FOR UPDATE) and
 * deleted inside a transaction, so concurrent callbacks serialize and only
 * the first one succeeds.
 */
export async function consumeOAuthState(state: string, provider: string): Promise<string> {
  assertSupportedProvider(provider);
  if (!state || typeof state !== "string") {
    throw new Error("Invalid or expired OAuth state.");
  }
  // The transaction callback returns a result instead of throwing so the
  // single-use DELETE commits even when validation fails below.
  // Expiry is evaluated with the database clock (expires_at > CURRENT_TIMESTAMP)
  // to avoid false positives from app/DB clock skew.
  const result = await transaction(async (client) => {
    const found = await client.query<StateRow & { is_valid: number }>(
      `SELECT provider, encrypted_verifier,
              expires_at > CURRENT_TIMESTAMP(3) AS is_valid
       FROM oauth_states WHERE state=$1 FOR UPDATE`,
      [state],
    );
    const row = found.rows[0];
    if (!row) {
      return { ok: false as const, reason: "Invalid or expired OAuth state." };
    }
    // Delete immediately to enforce single-use, even if validation fails.
    await client.query("DELETE FROM oauth_states WHERE state=$1", [state]);
    if (!row.is_valid) {
      return { ok: false as const, reason: "OAuth state has expired." };
    }
    if (row.provider !== provider) {
      return { ok: false as const, reason: "OAuth state provider mismatch." };
    }
    const encrypted =
      typeof row.encrypted_verifier === "string" ? row.encrypted_verifier : row.encrypted_verifier.toString("utf8");
    return { ok: true as const, verifier: decryptToken(encrypted) };
  });
  if (!result.ok) throw new Error(result.reason);
  return result.verifier;
}

/**
 * Verify that a code challenge matches its verifier (S256).
 * Constant-time comparison of the derived challenge.
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const expected = createHash("sha256").update(verifier).digest("base64url");
  if (expected.length !== challenge.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(challenge));
}

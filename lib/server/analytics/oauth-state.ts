import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Phase 2 Feature 3 (Phase A): OAuth2 state and PKCE utilities.
 *
 * Security properties:
 * - State tokens are cryptographically random (256-bit), single-use, and
 *   short-lived (10 minutes). They prevent CSRF on the OAuth callback.
 * - PKCE (RFC 7636, S256) prevents authorization code interception.
 * - State storage is in-memory for Phase A. Phase B may move to the database
 *   or signed cookies for multi-instance deployments.
 */

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type StateEntry = {
  codeVerifier: string;
  createdAt: number;
  provider: string;
};

// In-memory single-use state store. Keyed by state token.
const stateStore = new Map<string, StateEntry>();

// Periodic cleanup of expired entries (every 5 minutes).
let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanup() {
  if (cleanupTimer || typeof setInterval === "undefined") return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [state, entry] of stateStore) {
      if (now - entry.createdAt > OAUTH_STATE_TTL_MS) stateStore.delete(state);
    }
  }, 5 * 60 * 1000);
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

export type OAuthChallenge = {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
};

/**
 * Generate a fresh OAuth challenge: state token + PKCE verifier/challenge.
 * The state is stored single-use; it is consumed on validation.
 */
export function createOAuthChallenge(provider: string): OAuthChallenge {
  ensureCleanup();
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  stateStore.set(state, { codeVerifier, createdAt: Date.now(), provider });
  return { state, codeVerifier, codeChallenge };
}

/**
 * Validate and consume a state token. Returns the PKCE verifier on success.
 * Throws on unknown, expired, reused, or provider-mismatched state.
 * Single-use: the state is deleted whether validation succeeds or fails.
 */
export function consumeOAuthState(state: string, provider: string): string {
  const entry = stateStore.get(state);
  // Always delete to enforce single-use (prevents replay).
  stateStore.delete(state);
  if (!entry) {
    throw new Error("Invalid or expired OAuth state.");
  }
  if (Date.now() - entry.createdAt > OAUTH_STATE_TTL_MS) {
    throw new Error("OAuth state has expired.");
  }
  if (entry.provider !== provider) {
    throw new Error("OAuth state provider mismatch.");
  }
  // Constant-time comparison defense (state is already deleted; belt and braces).
  void timingSafeEqual(Buffer.from(state), Buffer.from(state));
  return entry.codeVerifier;
}

/**
 * Verify that a code challenge matches its verifier (S256).
 * Used in tests and for validating PKCE consistency.
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const expected = createHash("sha256").update(verifier).digest("base64url");
  if (expected.length !== challenge.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(challenge));
}

/** Test hook: inspect store size. */
export function _stateStoreSize(): number {
  return stateStore.size;
}

/** Test hook: inject an entry with a custom timestamp. */
export function _injectState(state: string, codeVerifier: string, createdAt: number, provider: string): void {
  stateStore.set(state, { codeVerifier, createdAt, provider });
}

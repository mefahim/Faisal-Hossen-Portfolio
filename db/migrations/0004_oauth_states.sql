-- Phase 2 Feature 3 (Phase B Step 1): persistent OAuth state storage
-- Replaces the Phase A in-memory Map so OAuth flows survive process restarts
-- and work correctly across multiple app instances.
-- No changes to existing tables. Additive only.
-- Manual rollback (migration runner has no DOWN support):
--   DROP TABLE IF EXISTS oauth_states;
--   DELETE FROM schema_migrations WHERE name = '0004_oauth_states.sql';

-- Single-use OAuth2 state tokens with PKCE verifiers.
-- - `state` is the cryptographically random CSRF token (base64url, 43 chars).
-- - `encrypted_verifier` holds the AES-256-GCM encrypted PKCE code verifier.
--   The verifier is NEVER stored in plaintext and NEVER exposed to the browser.
-- - Rows are consumed atomically (SELECT ... FOR UPDATE + DELETE in a
--   transaction); concurrent callbacks for the same state serialize and only
--   the first succeeds.
-- - Expired rows are purged opportunistically on challenge creation.
CREATE TABLE IF NOT EXISTS oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  encrypted_verifier TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  INDEX oauth_states_expires_idx (expires_at)
);

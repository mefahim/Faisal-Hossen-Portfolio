-- Phase 2 Feature 3 (Phase A): GA4 Integration foundation
-- New tables: provider_tokens + analytics_cache
-- No changes to existing tables. Additive only.
-- Manual rollback (migration runner has no DOWN support):
--   DROP TABLE IF EXISTS analytics_cache;
--   DROP TABLE IF EXISTS provider_tokens;
--   DELETE FROM schema_migrations WHERE name = '0003_provider_tokens.sql';

-- OAuth provider tokens (encrypted at rest with AES-256-GCM; see lib/server/analytics/encryption.ts)
-- Tokens are NEVER stored in plaintext. The `provider` column uses VARCHAR for
-- consistency with existing schema conventions (no ENUM).
CREATE TABLE IF NOT EXISTS provider_tokens (
  id CHAR(36) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_expiry DATETIME(3) NOT NULL,
  property_id VARCHAR(64) NULL,
  connected_by CHAR(36) NOT NULL,
  connected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_refresh_at DATETIME(3) NULL,
  UNIQUE KEY provider_tokens_provider_uniq (provider)
);

-- Cached GA4 report data (90-day retention; see lib/server/analytics/cache.ts)
-- Cache is keyed by (provider, property_id, date_range, report_type).
CREATE TABLE IF NOT EXISTS analytics_cache (
  id CHAR(36) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  property_id VARCHAR(64) NOT NULL,
  date_range VARCHAR(16) NOT NULL,
  report_type VARCHAR(32) NOT NULL,
  data_json JSON NOT NULL,
  fetched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY analytics_cache_lookup_uniq (provider, property_id, date_range, report_type),
  INDEX analytics_cache_fetched_idx (fetched_at)
);

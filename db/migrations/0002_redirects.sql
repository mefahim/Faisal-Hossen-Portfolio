-- Phase 2 Feature 2: Redirect Manager (planning-only)
-- New tables: redirects + redirect_audit
-- No changes to existing tables.
-- Manual rollback (migration runner has no DOWN support):
--   DROP TABLE IF EXISTS redirect_audit;
--   DROP TABLE IF EXISTS redirects;
--   DELETE FROM schema_migrations WHERE name = '0002_redirects.sql';

CREATE TABLE IF NOT EXISTS redirects (
  id CHAR(36) PRIMARY KEY,
  source_path VARCHAR(500) NOT NULL UNIQUE,
  target_url VARCHAR(2000) NOT NULL,
  status_code SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CHECK (status_code IN (301, 302, 307, 308))
);

CREATE TABLE IF NOT EXISTS redirect_audit (
  id CHAR(36) PRIMARY KEY,
  redirect_id CHAR(36) NULL,
  `action` VARCHAR(40) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  actor_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX redirect_audit_redirect_idx (redirect_id),
  INDEX redirect_audit_created_idx (created_at)
);

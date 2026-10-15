-- Phase 2 Website Health Audit Engine: audit runs and findings.
-- Additive only. No changes to existing tables.
-- Manual rollback (migration runner has no DOWN support):
--   DROP TABLE IF EXISTS health_findings;
--   DROP TABLE IF EXISTS health_audits;
--   DELETE FROM schema_migrations WHERE name = '0006_health_audits.sql';

CREATE TABLE IF NOT EXISTS health_audits (
  id CHAR(36) PRIMARY KEY,
  target_url VARCHAR(2048) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  pages_crawled INT NOT NULL DEFAULT 0,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  error_message VARCHAR(500) NULL,
  CHECK (status IN ('running','completed','failed')),
  INDEX health_audits_started_idx (started_at)
);

CREATE TABLE IF NOT EXISTS health_findings (
  id CHAR(36) PRIMARY KEY,
  audit_id CHAR(36) NOT NULL,
  category VARCHAR(16) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  check_name VARCHAR(64) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  evidence VARCHAR(1000) NOT NULL,
  recommendation VARCHAR(1000) NOT NULL,
  method VARCHAR(16) NOT NULL DEFAULT 'measured',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX health_findings_audit_idx (audit_id),
  CONSTRAINT health_findings_audit_fk FOREIGN KEY (audit_id) REFERENCES health_audits(id) ON DELETE CASCADE
);

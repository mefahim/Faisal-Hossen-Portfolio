CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(190) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_agent_hash CHAR(64) NULL,
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX sessions_user_active_idx (user_id, expires_at)
);
CREATE TABLE IF NOT EXISTS site_settings (
  id VARCHAR(32) PRIMARY KEY,
  draft JSON NOT NULL,
  published JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  draft_updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  published_revision_id CHAR(36) NULL,
  CHECK (status IN ('draft','published'))
);
CREATE TABLE IF NOT EXISTS pages (
  id CHAR(36) PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  route VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  draft JSON NOT NULL,
  published JSON NULL,
  published_revision_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  CHECK (status IN ('draft','published','archived'))
);
CREATE TABLE IF NOT EXISTS page_sections (
  id CHAR(36) PRIMARY KEY,
  page_id CHAR(36) NOT NULL,
  section_key VARCHAR(80) NOT NULL,
  section_type VARCHAR(80) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  draft JSON NOT NULL,
  published JSON NULL,
  UNIQUE KEY page_section_unique (page_id, section_key),
  CONSTRAINT page_sections_page_fk FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  CHECK (status IN ('draft','published','archived'))
);
CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  position INT NOT NULL DEFAULT 0,
  draft JSON NOT NULL,
  published JSON NULL,
  published_revision_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  CHECK (status IN ('draft','published','archived'))
);
CREATE TABLE IF NOT EXISTS media (
  id CHAR(36) PRIMARY KEY,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  mime_type VARCHAR(40) NOT NULL,
  byte_size BIGINT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  alt_text VARCHAR(500) NOT NULL,
  focal_x DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  focal_y DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  derivatives JSON NOT NULL,
  processing_state VARCHAR(16) NOT NULL DEFAULT 'ready',
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  CHECK (byte_size > 0 AND byte_size <= 10485760),
  CHECK (width > 0 AND height > 0),
  CHECK (focal_x BETWEEN 0 AND 1 AND focal_y BETWEEN 0 AND 1),
  CHECK (processing_state IN ('processing','ready','failed'))
);
CREATE TABLE IF NOT EXISTS project_media (
  project_id CHAR(36) NOT NULL,
  media_id CHAR(36) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'gallery',
  position INT NOT NULL DEFAULT 0,
  alt_text VARCHAR(500) NOT NULL,
  focal_x DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  focal_y DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  PRIMARY KEY (project_id, media_id, role),
  CONSTRAINT project_media_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT project_media_media_fk FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS navigation_items (
  id CHAR(36) PRIMARY KEY,
  location VARCHAR(16) NOT NULL,
  label VARCHAR(80) NOT NULL,
  href VARCHAR(255) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  draft JSON NOT NULL,
  published JSON NULL,
  published_revision_id CHAR(36) NULL,
  published_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CHECK (location IN ('header','footer')),
  CHECK (status IN ('draft','published','archived'))
);
CREATE TABLE IF NOT EXISTS seo_metadata (
  id CHAR(36) PRIMARY KEY,
  route VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  draft JSON NOT NULL,
  published JSON NULL,
  published_revision_id CHAR(36) NULL,
  published_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CHECK (status IN ('draft','published'))
);
CREATE TABLE IF NOT EXISTS contact_submissions (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(320) NOT NULL,
  company VARCHAR(300) NOT NULL DEFAULT '',
  subject VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  delivery_error_code VARCHAR(80) NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'website-contact',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CHECK (status IN ('new','reviewing','qualified','won','archived')),
  CHECK (delivery_status IN ('pending','sent','failed','not_configured')),
  INDEX contact_submissions_created_idx (created_at)
);
CREATE TABLE IF NOT EXISTS revisions (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(16) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  snapshot JSON NOT NULL,
  author_id CHAR(36) NULL,
  publish_state VARCHAR(16) NOT NULL,
  restores_revision_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT revisions_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT revisions_restore_fk FOREIGN KEY (restores_revision_id) REFERENCES revisions(id) ON DELETE SET NULL,
  CHECK (entity_type IN ('settings','page','section','project','navigation','seo')),
  CHECK (publish_state IN ('draft','published','restored')),
  INDEX revisions_entity_idx (entity_type, entity_id, created_at)
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id VARCHAR(255) NULL,
  safe_metadata JSON NOT NULL,
  correlation_id VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT activity_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX activity_logs_created_idx (created_at)
);
CREATE TABLE IF NOT EXISTS login_attempts (
  subject_hash CHAR(64) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  window_started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_until DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS request_limits (
  bucket_hash CHAR(64) PRIMARY KEY,
  hits INT NOT NULL DEFAULT 0,
  window_started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

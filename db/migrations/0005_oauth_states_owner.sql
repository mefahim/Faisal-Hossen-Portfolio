-- Phase 2 Feature 3 (Phase B Step 2 fix): Track OAuth initiator for session resilience
-- Adds owner_id to oauth_states so the callback can attribute tokens to the
-- owner who initiated the flow, even if their session expired during the
-- Google authorization step. The state token remains the authentication;
-- this only records who created it.
-- Manual rollback:
--   ALTER TABLE oauth_states DROP COLUMN owner_id;
--   DELETE FROM schema_migrations WHERE name = '0005_oauth_states_owner.sql';

ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS owner_id CHAR(36) NULL;

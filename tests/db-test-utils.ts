/**
 * Test utilities for database-backed integration tests.
 *
 * These helpers gate tests on DATABASE_URL availability. Integration tests
 * that require a real database should skip gracefully when it is not
 * configured, so `npm test` passes in environments without MySQL/MariaDB.
 *
 * The disposable test database must be created and migrated separately
 * (see docs/ga4-setup.md or the test setup script). Tests never touch
 * production data.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

const execFileAsync = promisify(execFile);

/** True when a test database is configured via DATABASE_URL. */
export function isTestDatabaseAvailable(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url && url.trim().length > 0;
}

/**
 * node:test skip option value: set to a reason string when no DB is available,
 * or false when tests should run.
 */
export function skipIfNoDatabase(): string | false {
  if (!isTestDatabaseAvailable()) {
    return "DATABASE_URL not set; database integration tests skipped.";
  }
  return false;
}

/**
 * Run the repository migration runner against DATABASE_URL.
 * Used to set up the disposable test database schema.
 */
export async function runMigrations(repoRoot: string): Promise<void> {
  await execFileAsync("npx", ["tsx", "scripts/migrate.ts"], {
    cwd: repoRoot,
    env: { ...process.env },
    timeout: 60_000,
  });
}

/**
 * Generate a random 32-byte base64 test encryption key.
 * Test-only; never use for production data.
 */
export function generateTestEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}

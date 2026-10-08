# MySQL Phase 1 Handoff

## Current state

This branch contains the Phase 1 application with the database layer converted from PostgreSQL to **MySQL 8.0+**. Phase 2 and Phase 3 remain out of scope.

The conversion includes:

- `mysql2` connection pool and transaction adapter in `lib/server/db.ts`.
- MySQL foundation schema in `db/migrations/0001_foundation.sql`.
- MySQL migration, seed, seed-parity, and owner-bootstrap scripts.
- MySQL-compatible upserts, JSON extraction, generated UUIDs, session expiry, rate limits, media usage checks, contact persistence, revisions, and activity logs.
- `.env.example`, `RELEASE.md`, `FAISALS-ROOM-TODO.md`, and `FAISALS-ROOM-PHASE-1-REPORT.md` updated for MySQL.

## Verified in this workspace

- `pnpm typecheck` — passed.
- `pnpm test` — **6/6 passed**.
- `pnpm build` — passed; all public, private, and API routes compiled.

The following were **not claimed as passed**, because no MySQL service, production secrets, durable media path, owner input, or browser automation was available in this workspace:

- Migration execution and seed parity against a real MySQL 8+ instance.
- Authenticated browser workflows.
- Contact persistence against the deployed database.
- Media upload, restart durability, and private derivative delivery.
- Production-origin responsive, accessibility, and browser regression review.

## Operator execution order

From a clean checkout on the deployment host:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# Set real values; never commit .env.
pnpm db:migrate
pnpm db:seed
pnpm db:verify-seed
```

Required values:

- `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE`
- `DATABASE_SSL=true` only when required by the provider.
- `APP_SECURITY_SECRET` with at least 32 random characters.
- `NEXT_PUBLIC_SITE_URL` set to the verified production origin.
- `MEDIA_STORAGE_DIR` set to a private path that survives deploys and has restrictive permissions.
- Temporary `BOOTSTRAP_OWNER_EMAIL` and `BOOTSTRAP_OWNER_PASSWORD` for the one-time bootstrap only.

Then run:

```bash
pnpm db:bootstrap-owner
# Remove BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD immediately.
pnpm build
# Copy public/ and .next/static/ into .next/standalone/ as documented in RELEASE.md.
pnpm start
```

## Phase 1 acceptance checklist

1. Confirm migration creates every table and can be rerun safely.
2. Confirm seed and `pnpm db:verify-seed` pass on the target MySQL version.
3. Sign in with the bootstrapped owner; verify anonymous private-route redirect, invalid-login throttling, logout, and password rotation.
4. Save a draft, inspect preview, publish, verify public rendering, create a revision, and restore it as a draft.
5. Upload an image, verify original/derivatives are outside `public/`, restart the app, and verify private media delivery still works.
6. Submit the contact form and confirm the lead and activity record persist; verify the honest `not_configured`/`failed`/`sent` delivery state.
7. Test same-origin and cross-origin mutation behavior, rate limits, and private route/API authorization.
8. Run browser checks at mobile, tablet, and desktop widths, including keyboard focus, labels, status announcements, contrast, reduced motion, and no horizontal overflow.
9. Record exact commands, environment/version, pass/fail results, and any provider-specific caveat in the Phase 1 report.
10. Mark Phase 1 **Accepted only after all evidence is real and recorded**. Do not switch `CONTENT_SOURCE=database` until published records are reviewed; keep file-backed content as the rollback path.

## Before Phase 2 starts

Phase 1 must be formally Accepted in the report. The owner must separately approve Phase 2 scope, Google API ownership and OAuth scopes, consent/privacy decisions, analytics data retention, SEO/audit requirements, and any redirect or advanced lead behavior. No Phase 2 code should be started from this handoff until those approvals are recorded.


## Recorded acceptance execution — 2026-10-08

A real isolated local MySQL `8.0.46-0ubuntu0.24.04.4` instance was exercised against the final Phase 1 source. Migration and seed each ran twice; `pnpm db:verify-seed` passed deep source parity for settings, 3 projects, 7 pages/9 sections, 7 navigation records, 7 SEO records, and checksummed metadata for 3 project images. The single-owner bootstrap succeeded once and rejected a second owner. The disposable test database contained 16 tables and one migration record.

The authenticated API acceptance run passed login throttling and lockout, owner-only authorization, draft/preview/publish/restore lifecycle, published-snapshot preservation, file-backed public rollback behavior, persisted contact lead/activity and owner-inbox read, private validated image original/WebP handling, invalid/oversize upload rejection, media metadata, archive protection, password rotation, and session revocation. The standalone app was restarted; the test session and uploaded image original/derivative remained readable from the isolated local database/filesystem. `pnpm typecheck`, `pnpm test` (6/6), and `pnpm build` passed. See the Phase 1 report for the exact outcomes and scope.

These results are **local acceptance evidence only**. They do not prove production database parity, production storage durability across a release, or deployed Faisal’s Room routes. On the current live origin, `/faisals-room` and `/faisals-room/login` return 404; `/robots.txt` excludes `/api/` but not `/faisals-room`. Keep `CONTENT_SOURCE=files`; do not mark Phase 1 Accepted or change the public source until production parity, rollback, durable storage, and deployed regression checks pass.

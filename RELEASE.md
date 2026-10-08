# Faisal Hossen Portfolio — Release and Faisal’s Room Runbook

**Application:** Next.js App Router portfolio with the Phase 1 single-owner Faisal’s Room foundation
**Runtime:** Node.js 22+ and pnpm 11
**Hosting baseline:** Existing Hostinger LiteSpeed Passenger deployment
**Public content source at release:** checked-in TypeScript files (`CONTENT_SOURCE=files`)
**Private route:** `/faisals-room` (never `/admin`)

## Phase boundary

This release contains **Phase 1 only**: private access, content drafts/publishing, media metadata/upload, durable leads, revisions, activity history, and migration-safe public reads. GA4/Search Console data, audit scoring, redirects, advanced leads, scheduled jobs, backups, monitoring, and future modules are **not implemented**. Do not start Phase 2 or Phase 3 without separate approval.

For the MySQL conversion, operator execution order, exact acceptance checklist, and Phase 2 prerequisite gate, use [`MYSQL-PHASE-1-HANDOFF.md`](./MYSQL-PHASE-1-HANDOFF.md).

## Hosting and runtime

The project retains `output: "standalone"`. Run the generated `.next/standalone/server.js` entrypoint through `pnpm start` (not `next start`); it listens on the host-provided `PORT`. Copy `public/` and `.next/static/` into the standalone tree after each build as shown below. Keep private media in durable storage outside `public/` and outside any release directory that is replaced during deploy. This release uses the configured server filesystem path; it is not an object-storage integration. If the hosting account cannot provide a durable private path, provision an appropriate storage adapter before accepting uploads in production.

Install and build:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
mkdir -p .next/standalone/.next
cp -a public .next/standalone/
cp -a .next/static .next/standalone/.next/
PORT=3000 pnpm start
```

For Passenger, deploy `.next/standalone/` after the two copy operations, preserve the database and media paths across releases, and set the process working directory/environment correctly. Passenger supplies its own `PORT`; the local command above demonstrates only a fallback test. Follow the hosting provider’s deployment process; do not commit production secrets.

## Required production inputs

Set these in the hosting provider’s protected environment/secrets manager:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes for production SEO | Verified public origin used for canonical, sitemap, and social metadata. |
| `DATABASE_URL` | Yes for Faisal’s Room and contact storage | MySQL 8+ connection string with a database dedicated to this application. |
| `APP_SECURITY_SECRET` | Yes for authenticated/rate-limited use | Cryptographically random secret with at least 32 characters; do not reuse a password. |
| `MEDIA_STORAGE_DIR` | Yes before uploads | Absolute durable server path outside `public/`, surviving releases. Restrict filesystem permissions to the app process. |
| `CONTENT_SOURCE` | Start as `files` | Change to `database` only after seed parity and content review. |
| `DATABASE_SSL` | Provider-dependent | `true` only if required; certificate validation remains enabled. |
| `RESEND_API_KEY`, `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL` | Optional | Enables an email notification after the lead has been stored. Sender must be verified with Resend. |

Never put a real secret into Git, a client-side `NEXT_PUBLIC_*` variable, or a chat message. `.env.example` contains placeholders only.

## One-time database and owner setup

1. Provision MySQL 8+ and durable private media storage. Back up the database before any future content-source switch.
2. Set `DATABASE_URL`, `DATABASE_SSL` if needed, `APP_SECURITY_SECRET`, `MEDIA_STORAGE_DIR`, and the production origin. Keep `CONTENT_SOURCE=files`.
3. Install dependencies and run the idempotent migration and seed commands:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   pnpm db:verify-seed
   ```

4. Review the parity output. Seeded settings, projects, page structures, navigation, SEO foundation records, and image metadata remain drafts; a seed does **not** make content public.
5. Temporarily set `BOOTSTRAP_OWNER_EMAIL` and a strong `BOOTSTRAP_OWNER_PASSWORD` (14–256 characters) in the server environment, then run:

   ```bash
   pnpm db:bootstrap-owner
   ```

   This command refuses to create a second owner. **Immediately remove both bootstrap environment variables, especially the password.**
6. Sign in at `/faisals-room/login`, review records, and publish only content that has been manually checked. A rendered draft preview is owner-only and uncached.
7. Keep `CONTENT_SOURCE=files` until you deliberately want reviewed published records to drive the public routes. Set `CONTENT_SOURCE=database` only after parity, visual review, and rollback preparation. Incomplete project/navigation content and invalid/unavailable database reads fall back to checked-in content.
8. Verify the published public output and contact flow. Submit a test only after the real database and optional email configuration are in place; do not send a production test message to a real recipient without coordination.

## Contact behavior

The contact route validates origin, input and honeypot, applies a database-backed rate limit, commits the lead and an activity record before attempting optional Resend delivery, and reports `sent`, `failed`, `not_configured`, or `pending` honestly. Without `DATABASE_URL`, durable contact storage is unavailable and submissions are not accepted as saved. Do not represent that state as successful delivery.

## Smoke-test checklist after configuration

- Public: `/`, `/work`, all three existing `/work/<slug>` pages, `/about`, `/contact`; compare content, identity imagery, links, metadata, and responsive behavior with the current public release.
- Private: anonymous visits to `/faisals-room` redirect to `/faisals-room/login`; invalid credentials return a generic error; valid owner can access each Phase 1 route; logout and password rotation revoke sessions as expected.
- CMS: edit/save a draft, confirm it is absent from the public view, open authenticated preview, publish explicitly, verify only the intended public change, review revision history, and restore as a new draft.
- Media: reject oversize/malformed/SVG files, confirm WebP preview is available only through authenticated media access until a project referencing it is published, and ensure uploads persist across an application release.
- Leads: submit a controlled test, verify durable storage before email delivery, verify notification states, and inspect the owner-only inbox.
- Crawl: `/robots.txt` excludes `/api/` and `/faisals-room`; `/sitemap.xml` and `public/manus-routes.json` contain only public page routes.

## Historical Phase 1 verification status at implementation handoff

TypeScript, the schema unit suite, and a production build are run in the implementation workspace. Database migration/seed parity, authenticated browser flows, durable media persistence, and the production-origin visual/accessibility review must still be completed against the operator-provided MySQL 8+, filesystem, domain, and owner credentials. See [`FAISALS-ROOM-PHASE-1-REPORT.md`](./FAISALS-ROOM-PHASE-1-REPORT.md) and [`FAISALS-ROOM-TODO.md`](./FAISALS-ROOM-TODO.md).
On 2026-10-08, a clean checkout also passed frozen dependency installation, `pnpm typecheck`, `pnpm test` (6/6), standalone `pnpm build`, public route smoke checks, private-route redirect, same-origin/cross-origin mutation guards, and robots/sitemap exclusion checks. Database migration/seed parity, authenticated browser flows, durable media persistence, contact persistence, and the production-origin visual/accessibility review still must be completed against the operator-provided MySQL 8+, filesystem, domain, owner credentials, and deployed host. See [`FAISALS-ROOM-PHASE-1-REPORT.md`](./FAISALS-ROOM-PHASE-1-REPORT.md) and [`FAISALS-ROOM-TODO.md`](./FAISALS-ROOM-TODO.md). Do not mark Phase 1 accepted from these local checks alone.


## Final Phase 1 acceptance status — 2026-10-08

Local acceptance on a real isolated MySQL 8.0.46 server and the standalone production build passed: repeated migration/seed and deep source parity; one-time owner bootstrap; authenticated security and content lifecycle; persisted contact/inbox state; private media validation/metadata/restart delivery; session revocation; and the 126-check local browser viewport matrix. The current source passes `pnpm typecheck`, `pnpm test` (8/8), and `pnpm build`. Hostinger MariaDB 11.8.9 migration/seed/deep parity and the one-time owner bootstrap also passed. Full results and boundaries are in [`FAISALS-ROOM-PHASE-1-REPORT.md`](./FAISALS-ROOM-PHASE-1-REPORT.md).

The first Hostinger Passenger candidate was activated and returned HTTP 500 at `/faisals-room/login`; runtime stderr reported a missing `react-dom/server.browser` module and an Argon2 native-binding error. The exact prior release symlink was restored. A fresh standalone build now explicitly traces `react-dom/**/*`; it contains `react-dom/server.browser`, and local production smoke checks returned 200 for login and 307-to-login for anonymous private/preview routes. This corrected candidate has not yet been reactivated or verified on Hostinger. The older release is currently live; its Phase 1 routes return 404 and `/robots.txt` does not exclude `/faisals-room`.

`CONTENT_SOURCE=files` remains active. Production database parity and rollback have been verified, but the corrected deployed authentication/runtime, media durability across a release, crawl policy, and deployed browser/security/accessibility checks remain open. **Phase 1 is not officially Accepted.** Do not switch the public source or mark acceptance until those remaining checks pass. Phase 2 and Phase 3 remain out of scope.

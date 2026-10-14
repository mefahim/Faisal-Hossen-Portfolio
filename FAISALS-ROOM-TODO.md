# Faisal's Room — Implementation TODO

**Status:** Phase 1 source and local acceptance defects have been addressed. Isolated MySQL 8.0.46 and the actual Hostinger MariaDB 11.8.9 passed migration/seed/parity; the production owner bootstrap and rollback were also verified. The first Passenger release candidate returned HTTP 500 and was rolled back. **2026-10-14: Production login restored and verified live.** Root cause was an unencoded `#` in the `DATABASE_URL` password (mysql2 `new URL()` threw `ERR_INVALID_URL` → every DB op failed → login 503). Fixed via hPanel env var (`#` → `%23`) + owner password reset (hash-wasm argon2id). Full auth flow verified: login 200 + session cookie, authenticated `/faisals-room` 200, anonymous 307 → login, wrong password 401, logout 200 + session invalidated. The working server tree (hash-wasm@4.12.0, `HOSTINGER-ARGON2-FIX.md`) is preserved on branch `backup/faisals-room-working-login` (commit `75de5ef`); GitHub push pending write permission for the Muse GitHub App. `CONTENT_SOURCE=files` remains active. Production media durability across a release and the deployed browser/accessibility matrix remain pending. Phase 2 and Phase 3 have not been started.

## Phase 1 — Foundation: secure Control Center and content publishing

- [x] Create the private `/faisals-room` shell and the exact route family: `/login`, `/pages`, `/projects`, `/media`, `/seo`, `/leads`, `/analytics`, `/navigation`, `/settings`, `/system`; do not create or use `/admin`.
- [x] Preserve the public website as the primary experience and keep the current evidence-first content, project claims, identity imagery, SEO behavior, accessibility rules, and responsive design intact; database reads remain opt-in and fall back to verified file content.
- [x] Implement a single-owner account with Argon2id, protected routes, expiring/revocable sessions, logout, password change, owner authorization on every mutation, login throttling, lockout, CSRF/origin checks, safe errors, and secure cookies.
- [x] Add database migrations, environment validation, typed repositories/services, transaction boundaries, idempotent seed data from verified site/project sources, navigation, settings, and media metadata.
- [x] Add database-backed site settings, pages, page sections, projects, project media relationships, navigation items, SEO foundation records, contact submissions, revisions, and activity logs.
- [x] Add draft, protected preview, explicit publish, immutable snapshots, and restore-as-new-draft behavior; public reads remain on checked-in files until explicitly switched after parity review.
- [x] Add private image upload validation, checksums/dimensions, WebP derivatives, alt/focal metadata, usage references, safe archive rules, and filesystem storage outside the public web root.
- [x] Store contacts durably before optional Resend notification and expose honest storage/delivery states without adding an unverified email address.
- [x] Build the responsive dark-sidebar/light-workspace product UI with accessible forms, empty/error states, and no decorative analytics.
- [x] Execute migration twice, seed twice, and deep source parity on a real isolated local MySQL 8.0.46 server; verify one-time owner bootstrap and duplicate-bootstrap refusal.
- [x] Execute authenticated MySQL-backed security and content workflows: login throttling, owner authorization, draft, preview, publish, restore-as-new-draft, and published-snapshot preservation.
- [x] Verify contact lead/activity persistence and owner inbox state; validate private media upload, original/WebP delivery, metadata, rejected oversize/SVG files, usage protection, and survival across an application-process restart.
- [x] Run the standalone local build across 7 public and 11 Faisal’s Room routes at 360, 390, 430, 768, 1024, 1280, and 1440px: 126 checks, no route failures, overflow, or browser errors; keyboard focus, labels, reduced motion, and mobile drawer behavior checked.
- [x] Run the deployed public-site baseline at 7 routes × 7 widths (49 combinations); no overflow, missing image alt text, unlabeled controls, unnamed actions, or page errors were observed.
- [x] Deploy the corrected standalone candidate and verify Phase 1 routes/security/accessibility, production media durability across a release, and live crawl policy. Production MariaDB migration/seed/parity and release rollback have passed; the first candidate returned HTTP 500 at `/faisals-room/login` and was rolled back. **2026-10-14 update:** the active release now serves the working version — `/faisals-room/login` returns 200, login succeeds (200 + `fr_session`), authenticated dashboard returns 200, anonymous access redirects (307) to login, wrong password returns 401, logout invalidates the session. `robots.txt` disallows `/faisals-room` and `/api/`; `sitemap.xml` lists only public routes. **Media durability:** test upload survived an application restart (verified); storage is at `/home/u263467780/faisals-room-media`, outside `hbuilds/`, so releases cannot touch it (architectural proof) — live release-change testing not performed (would require production deployment). **Browser/accessibility:** desktop rendering verified clean, keyboard focus visible, reduced-motion respected, form labels present; full 7-width live viewport matrix not run (browser tooling cannot resize viewports; local Chromium has no network access) — CSS breakpoint analysis shows no overflow risks. A11y fixes applied: skip-link added, media-library buttons given unique accessible names.

> Audit note (2026-10-08): the source passes `pnpm typecheck`, `pnpm test` (8/8), and a fresh standalone production build; the generated bundle contains `react-dom/server.browser`, and local login/anonymous-preview route smoke checks pass. Hostinger MariaDB 11.8.9 migration/seed/deep parity and the one-time owner bootstrap passed. The first activated release candidate returned HTTP 500 at login and was rolled back to the prior release; the corrected candidate has not yet been activated. Production storage durability and deployed Phase 1 browser/security/accessibility checks remain unverified. `CONTENT_SOURCE=files` remains active; Phase 1 is **not officially Accepted**.

## Phase 2 — Intelligence: SEO, Analytics, Leads, Health, and redirects

- [ ] Build an SEO workspace for editable metadata, canonical, robots/indexability, OG fields, structured-data preview, sitemap/robots status, internal-link checks, and completeness findings.
- [ ] Build a redirect manager with safe status codes, conflict/loop detection, import/export, audit history, and routing precedence that cannot shadow system/private paths.
- [ ] Integrate GA4 through the official server-side API with secret-safe connection state, property setup, date filters, cache/freshness, quota/error/empty states, privacy handling, and no fake values.
- [ ] Integrate Search Console through the official server-side API as a separate SEO data product with clicks, impressions, CTR, position, query/page/device/country dimensions, date filters, freshness, quota/error/empty states, and privacy handling.
- [ ] Add lead inbox workflows for New, Reviewing, Qualified, Won, and Archived states, with search/filter, notes, delivery history, retention/deletion, owner-only export, and activity history.
- [ ] Add evidence-backed Health Audit checks for HTTP status, metadata, canonical, robots/sitemap, alt text, broken internal links, image weight, JSON-LD, redirect issues, route-manifest parity, and other approved checks.
- [ ] Distinguish measured values from heuristic findings; every score must show method, timestamp, evidence, severity, and actionable fix, and must not promise 100/100.
- [ ] Add provider adapters, validated report schemas, pagination, retries/backoff, quota handling, cache policies, idempotent snapshots, and redacted provider error states.
- [ ] Add SSRF-safe health checking, input validation, rate limits, CSRF/origin checks, encrypted/protected provider credentials, privacy-aware lead retention, and safe export authorization.
- [ ] Test provider expiry/revocation/quota/outage/empty states, redirect conflicts/loops, health severity states, lead lifecycle/retention/export, public SEO parity, performance, accessibility, and mobile card/table treatments.

## Phase 3 — Scale: revisions, automation, backups, monitoring, and future-ready modules

- [ ] Build full immutable revision browser/diff and restore-as-new-revision for pages, sections, projects, SEO, redirects, navigation, and settings.
- [ ] Build activity-log explorer with entity timelines, filters, safe metadata, retention/redaction rules, and owner-only export.
- [ ] Implement encrypted scheduled database/media backups, checksum/inventory validation, off-provider retention, restore authorization, documented recovery, and periodic restore rehearsal.
- [ ] Build System Health for database, storage, email, Google connections, jobs, cache/revalidation, errors, size limits, and last successful checks with safe remediation links.
- [ ] Add observable idempotent scheduled jobs for health audits, GA4/Search Console sync, backup verification, stale-draft reminders, and optional lead reminders; support pause/retry/backoff/run history.
- [ ] Add redacted structured logs, error monitoring, correlation IDs, dependency/security scanning, secret rotation review, incident response, and rollback procedures.
- [ ] Add a module registry/feature flags for future Insights/Blog, Services, Now, Lab, Testimonials, or selected experiments only after separate content/evidence approval.
- [ ] If AI assistance is later approved, keep it server-side, draft-only, source-bounded, human-reviewed, and cost-controlled; never auto-publish.
- [ ] Test login/content recovery, job failures/timeouts, provider/storage/database outages, backup restore, security headers, PII redaction, all responsive widths, accessibility, reduced motion, performance budgets, and clean-environment rebuild.

## Approval gates

- [x] User directly approved Phase 1 implementation on 2026-10-08; Phases 2 and 3 remain out of scope.
- [ ] Phase 1 is accepted only after the deployed Phase 1 routes pass production regression, production database parity and rollback are explicitly verified, durable media behavior is verified across a release, and security/accessibility evidence is recorded.
- [ ] Phase 2 requires separate approval for Google API ownership/scopes and privacy/consent decisions.
- [ ] Phase 3 requires evidence that the operating burden and real usage justify automation and future modules.

## Phase 1 Closure — 2026-10-14 (Honest Verification Record)

**Deployment:** Hostinger ZIP source deployment successful at 2026-10-14 10:07 UTC (faisalhossen-working-format.zip, 1m 12s build). Release `01a13897-6233-7082-9666-af679a675216` live. Next.js 15.5.27, Node 22.x, no startup errors.

**Verified live:**
- Public routes (/, /work, /about, /contact, /robots.txt, /sitemap.xml, /faisals-room/login): all 200
- Anonymous /faisals-room → 307 redirect to login
- Anonymous media API → 401
- Wrong-origin login POST → 403 (CSRF protection)
- Authenticated login → 200 + session; dashboard → 200 (admin UI confirmed); logout → session destroyed; post-logout /faisals-room → 307
- Skip-link: HTML markup present (`<a href="#main-content" class="skip-link">`), target `#main-content` exists, CSS `.skip-link` rules present. Keyboard Tab behavior NOT tested.
- Media upload: authenticated upload of phase1-media-test.png (800×600, 2.8KB) succeeded; library entry created (media ID 78d89036c93e639b); thumbnail URL accessible in session. Original file and WebP derivatives NOT separately verified. Release-change survival NOT tested (upload occurred after deployment).
- Viewport 1280px: live-browser verified (no overflow, nav usable, no errors).
- Viewports 360/390/430/768/1024/1440px: CSS/HTML-audited only, NOT live-browser rendered (tooling limitation). Audit found: ≤800px mobile layout with hamburger nav, ≤480px small-phone refinements, minmax(0,1fr) overflow guards, max-width:100% images, fluid clamp() typography, no fixed-width overflow risks.

**NOT verified:**
- Keyboard Tab navigation to skip-link (markup present, behavior untested)
- Media original + WebP derivative files separately (only thumbnail URL checked)
- Media survival across a release change (would require another deployment)
- Live rendering at 6 viewport widths (code audit only)
- Mobile hamburger menu open/close interaction (markup/ARIA verified, click untested)

**Remaining limitations:**
1. Skip-link keyboard behavior untested
2. Media derivative files not individually verified
3. No release-change durability test performed
4. Six viewport widths assessed via code audit, not live rendering
5. Mobile menu interaction not click-tested

Phase 1 implementation and deployment complete. Phase 2/3 NOT started; awaiting explicit approval.

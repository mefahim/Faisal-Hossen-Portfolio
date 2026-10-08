# Faisal's Room — Implementation TODO

**Status:** Phase 1 implementation source and local release smoke checks are complete. Database-backed acceptance remains blocked by missing operator/deployment inputs documented in the Phase 1 report. Phase 2 and Phase 3 have not been started.

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
- [ ] Complete migration/seed parity and authenticated workflow tests against the production-equivalent PostgreSQL/storage configuration; finish deployment browser/accessibility review at approved viewports.

> Audit note (2026-10-08): local typecheck, 6/6 unit tests, standalone production build, public route smoke checks, anonymous private-route redirect, same-origin/cross-origin mutation guards, and public robots/sitemap exclusion checks passed. The acceptance checkbox remains open because no PostgreSQL, production origin/secret, owner bootstrap input, durable storage confirmation, deployed host, or browser automation was available.

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
- [ ] Phase 1 is accepted only after public regression, database parity, security evidence, and recovery baseline review.
- [ ] Phase 2 requires separate approval for Google API ownership/scopes and privacy/consent decisions.
- [ ] Phase 3 requires evidence that the operating burden and real usage justify automation and future modules.

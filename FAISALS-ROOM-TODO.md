# Faisal's Room — Implementation TODO

**Status:** Awaiting user approval. Do not implement any item until the master `plan.md` is approved.

## Phase 1 — Foundation: secure Control Center and content publishing

- [ ] Create the private `/faisals-room` shell and the exact route family: `/login`, `/pages`, `/projects`, `/media`, `/seo`, `/leads`, `/analytics`, `/navigation`, `/settings`, `/system`; do not create or use `/admin`.
- [ ] Preserve the public website as the primary experience and keep the current evidence-first content, project claims, identity imagery, SEO behavior, accessibility rules, and responsive design intact.
- [ ] Implement a single-owner account with secure password hashing, protected routes, expiring/revocable sessions, logout, password change, owner authorization on every mutation, login throttling, brute-force protection, CSRF/origin checks, safe errors, and secure cookies.
- [ ] Add database migrations, environment validation, typed repositories/services, transaction boundaries, and seed data from the current verified `content/site.ts`, `content/projects.ts`, project JSON source, navigation, settings, and media metadata.
- [ ] Add database-backed site settings, pages, page sections, projects, project media relationships, navigation items, SEO foundation records, contact submissions, revisions, and activity logs.
- [ ] Add draft, protected preview, publish, and restore-as-new-revision behavior; public routes must read published data only and must retain a safe file-backed fallback until database parity is proven.
- [ ] Add a media library with safe image upload validation, storage keys, checksums, dimensions, derivatives, alt text, focal/crop metadata, usage references, archive/delete rules, and no dangerous arbitrary-file handling.
- [ ] Change contact handling so the submission is durably stored before optional Resend notification; expose honest stored/delivery/error states without exposing secrets or inventing an email address.
- [ ] Build intentional desktop/mobile dashboard UX with dark sidebar/light workspace, editorial hierarchy, accessible forms, loading/empty/error states, touch-safe controls, and no generic admin-template styling.
- [ ] Test migration/seed parity, auth/session/authorization, publish/preview/restore, media validation, contact persistence, public route regression, accessibility, reduced motion, keyboard navigation, and required responsive widths.

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

- [ ] User reviews and explicitly approves `plan.md` before any Phase 1 implementation.
- [ ] Phase 1 is accepted only after public regression, database parity, security evidence, and recovery baseline review.
- [ ] Phase 2 requires separate approval for Google API ownership/scopes and privacy/consent decisions.
- [ ] Phase 3 requires evidence that the operating burden and real usage justify automation and future modules.

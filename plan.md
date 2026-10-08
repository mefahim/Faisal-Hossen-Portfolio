# Faisal's Room — Master Audit and Exactly 3-Phase Implementation Plan

**Status:** Approved for Phase 1 implementation by the repository owner on 2026-10-08. Phase 1 only is in scope; Phases 2 and 3 remain unstarted and require separate authorization.

**Repository audited:** `https://github.com/mefahim/Faisal-Hossen-Portfolio`

**Audited checkout:** `main` at commit `9f05612` (2026-10-08)

**Master planning sources:**

- Notion blueprint: `Faisal's Room — Master Product Vision, Requirements & 3-Phase Implementation Blueprint`
- Referenced Notion website specification: `Faisal Hossen — Personal Website Master Specification v2`
- Repository documents: `README.md`, `TODO.md`, `PHASE-1-REPORT.md`, `PHASE-2-REPORT.md`, `PHASE-2-HANDOFF.md`, `FINAL-REFINEMENT-REPORT.md`, `RELEASE.md`, content models, routes, components, and assets.

## 1. Executive audit summary

The repository is a working Next.js App Router public portfolio, not yet a CMS or private control center. It has a coherent editorial/product visual system, truthful project content, responsive public routes, route-aware metadata, sitemap/robots, a valid page-route manifest, a functional contact form UI, and a server-side Resend delivery route. The public surface currently consists of Home, Work, three project case studies, About, and Contact. The production build and TypeScript checks pass in the audited checkout.

The key architectural fact is that the current content layer is entirely file-backed: `content/site.ts` and `content/projects.ts` are imported directly by Server Components. There is no database, authentication, private route protection, media library, revision model, lead persistence, analytics integration, Search Console integration, redirect manager, health audit engine, activity log, or backup/recovery implementation. The contact API sends email when configured but does not store a lead, enforce rate limits, verify CSRF/origin, or create an audit record.

The recommended approach is incremental migration rather than a rewrite. Keep the public website stable and evidence-led. First establish a small, secure, single-owner control-center foundation and a database-backed content read path with draft/publish safety. Then add measured intelligence for SEO, analytics, leads, health, and redirects. Finally add controlled automation, revisions, activity history, backups, monitoring, and extension points. A generalized multi-tenant page builder, fake analytics, unnecessary visual effects, and unrelated CRM/product features are intentionally outside this plan.

## 2. What is already implemented

| Area | Evidence in repository | Current state |
| --- | --- | --- |
| Public frontend | `app/`, `components/site/` | Next.js 15 App Router, React, TypeScript, Server Components by default, small client components for navigation/playground/reveal/form. |
| Public routes | `app/page.tsx`, `app/work/`, `app/about/`, `app/contact/` | Home, Work, three static project routes, About, Contact. No `/services`, `/insights`, `/now`, or `/lab`. |
| Content | `content/site.ts`, `content/projects.ts`, three source JSON files | File-backed and evidence-led. No runtime editing. |
| Visual system | `app/globals.css`, Tailwind config, `next/font/google` | Warm ivory/editorial product system, restrained motion, responsive CSS, focus and reduced-motion rules. |
| Projects/media | `content/projects.ts`, `public/assets/projects/` | Three committed project visuals and structured case-study fields. No upload or media management. |
| Contact | `components/site/ContactForm.tsx`, `app/api/contact/route.ts` | Client/server validation and environment-based Resend send. No persistence, lead status, inbox, rate limit, or anti-abuse layer. |
| SEO foundation | `lib/metadata.ts`, `app/sitemap.ts`, `app/robots.ts`, JSON-LD, `public/manus-routes.json` | Basic metadata and crawl files exist. No editable SEO records, redirects, Search Console, query reports, or health scoring. |
| Deployment | `next.config.ts`, `RELEASE.md` | Standalone Node/LiteSpeed deployment instructions exist; server capability is needed for contact API. |
| Testing evidence | reports and build output | `pnpm exec tsc --noEmit` and production build pass. Manual responsive/browser review is documented. No automated test suite, accessibility CI, or performance budget CI exists. |

## 3. Missing work, technical debt, and conflicts

### 3.1 Product and information architecture gaps

- There is no `/faisals-room` surface, login route, private navigation, dashboard shell, or protected workspace.
- The requested control center modules—Pages, Projects, Media, SEO, Leads, Analytics, Navigation, Settings, and System—do not exist.
- The repository navigation contains only public routes. It must stay separate from the private control-center navigation.
- Public copy and historical reports still contain some stale phase language and earlier implementation assumptions. These should be treated as documentation debt, not runtime content.

### 3.2 Data and API gaps

- All public content is imported from TypeScript modules; there is no database schema or migration system.
- No entities exist for users, sessions, site settings, pages, sections, projects, project media, SEO metadata, redirects, navigation items, contact submissions, revisions, audit logs, analytics connections, snapshots, or health findings.
- `/api/contact` only sends an email through Resend and returns a response. It does not store the submission before delivery, so leads can be lost or cannot be managed.
- There is no service/repository boundary between route handlers and content persistence.
- There is no cache invalidation or revalidation strategy for future published content.

### 3.3 Security gaps

- No private authentication, password hashing, session management, authorization, login throttling, brute-force protection, CSRF/origin policy, or account recovery exists.
- The contact endpoint has input length checks but no IP/user-agent rate limiting, spam trap, abuse monitoring, or structured safe logging.
- Upload security does not exist because uploads do not exist. Future media work must not accept arbitrary files without MIME sniffing, size limits, image decoding validation, filename normalization, storage isolation, and dangerous-content handling.
- Security headers, CSP decisions, secret rotation, and audit-log retention are not defined in source.
- A single-owner personal CMS is the right target; multi-tenant roles and generalized organization permissions would create unnecessary risk and scope.

### 3.4 SEO, analytics, and health gaps

- No GA4 integration or official Google Analytics Data API connection exists.
- No Search Console API connection exists. GA4 engagement and Search Console search performance must remain separate data products.
- No connection state, consent/privacy decision, server-side token storage, date filters, cache window, quota handling, or empty/error state exists.
- `sitemap.ts` uses `new Date()` for every route response rather than content-derived dates, which can create unstable last-modified signals.
- No editable SEO title/description/OG fields, canonical override, noindex controls, redirect manager, broken-link scan, metadata audit, structured-data audit, or measured/heuristic health score exists.
- The social links are exact supplied values but should be re-verified as real profile destinations before a CMS exposes them as global settings.

### 3.5 UX, accessibility, and performance risks

- The public design direction is strong and must not be replaced by an AdminLTE/WordPress-style dashboard. Faisal's Room needs a dark sidebar/light workspace, editorial hierarchy, and app-like mobile behavior.
- The current `ProblemPlayground` uses a tablist but does not implement full arrow-key tab movement; this is a small public accessibility debt to address without changing the content model.
- `Reveal` makes multiple sections client components. Keep it, but avoid expanding client-side state unnecessarily in the control center.
- Several supplied PNG portraits/project images are approximately 1.9–2.3 MB. Media migration should generate responsive derivatives and preserve originals outside the request path.
- There is no automated 360/375/390/430/768/1024/1280/1440/1600 viewport matrix, Lighthouse budget, bundle budget, or accessibility regression gate.

### 3.6 Documentation and delivery risks

- `PHASE-1-REPORT.md` contains historical statements that predate the completed Work/About/Contact and Faisal Hossen identity refresh. It must remain historical, but a new master plan must be the continuation source.
- Existing hosting instructions are source/deployment handoff notes, not a production operations runbook for database backups, secrets, rollback, monitoring, or incident response.
- The managed Webdev project and the user's GitHub repository have had separate history transitions. Every future agent must verify the canonical remote, current branch, and checkpoint before changing files.
- Phase 1 implementation started only after the user's direct request on 2026-10-08. External deployment/database configuration remains a handoff prerequisite; Phases 2 and 3 are not authorized by that request.

## 4. Target architecture and migration principles

The existing Next.js App Router remains the foundation. The public site stays at the root routes. Faisal's Room is a single-owner, server-backed private product under `/faisals-room/*`; it is not `/admin` and it is not a multi-tenant CMS.

Use a modular monolith first: route handlers/server actions call typed domain services, which call repositories for database, object storage, and external APIs. Keep provider adapters behind interfaces so Resend, Google APIs, and storage can be changed without moving UI code. Server Components remain the default. Client components are limited to form state, filters, charts, drag/reorder interactions, and explicitly interactive mobile controls.

Use a relational database with migrations. Prefer a boring SQL-backed solution supported by the chosen hosting/runtime. Keep immutable published snapshots or revision records so a failed edit can be rolled back without reconstructing content from UI state. Use object storage for media originals and derivatives; database rows own metadata, references, alt text, and usage.

The public read path should support a safe transition: initially keep file-backed content as a fallback and seed the database from the verified modules. Switch individual content families behind feature flags or a read adapter. Never make a half-migrated page silently return empty content. Published reads should be cached/revalidated; preview/draft reads must be private and uncached.

## 5. Exactly three implementation phases

### Phase 1 — Foundation: secure Control Center and content publishing

**Objective:** Establish the private Faisal's Room shell, secure single-owner access, database-backed core content, media metadata, and safe draft/publish workflow while preserving the public website.

**Scope and feature set**

- Add `/faisals-room` and the exact private route family: `/login`, `/pages`, `/projects`, `/media`, `/seo`, `/leads`, `/analytics`, `/navigation`, `/settings`, and `/system`.
- Build a responsive dark-sidebar/light-workspace shell with active navigation, breadcrumbs, page titles, context actions, status badges, empty states, loading states, error states, and mobile drawer navigation.
- Implement login, logout, session expiry, protected-route middleware/server checks, one owner account, password change, and safe unauthenticated redirects.
- Add core content management for site settings, public pages/sections, projects, project images, navigation items, and SEO metadata. Preserve current public content and project evidence exactly during seeding.
- Add media library metadata and safe upload pipeline for approved image formats, with alt text, focal point/crop metadata, usage references, derivatives, and delete/archive rules.
- Add draft/publish states and an explicit publish action for pages, projects, navigation, and settings. Public routes read published data only.
- Add the first revision record on publish and a minimal activity record for authentication and content mutations.
- Keep the current contact form behavior working while adding a database write path for submissions; email delivery remains an optional notification after durable storage succeeds.

**UI/UX deliverables**

- Product-quality dashboard, not a generic admin template: calm typography, dense-but-readable tables, clear editorial forms, restrained accent usage, and no decorative dashboard charts.
- Mobile layouts intentionally designed at 360, 390, 430, and 768px: touch-safe controls, bottom-sheet/drawer patterns where useful, no wide tables without an intentional mobile treatment.
- Content editor forms with visible labels, inline validation, unsaved-change warning, draft/published status, preview link, and clear destructive-action confirmation.
- Media cards/list view with search/filter, upload progress, alt-text state, usage count, and safe empty/error states.
- Leads inbox foundation with status and source fields, even if advanced filtering waits for Phase 2.

**Technical architecture work**

- Add server capability and database configuration through environment secrets; never expose database credentials or provider tokens to client bundles.
- Introduce typed domain modules such as `lib/server/auth`, `lib/server/content`, `lib/server/media`, `lib/server/leads`, `lib/server/revisions`, and `lib/server/audit` with repository boundaries.
- Add database migrations, seed scripts, environment validation, transaction helpers, and a publish/revalidate mechanism.
- Add a public content adapter that can read either seeded database records or the existing verified file modules during migration; remove fallback only after parity checks.
- Keep the route manifest limited to page routes and exclude APIs/private routes from public sitemap and crawlable navigation.

**Data/database work**

Initial entities, improved from the Notion suggestions:

- `users`: single-owner account, password hash, status, timestamps.
- `sessions`: hashed session token, user, expiry, revocation metadata.
- `site_settings`: singleton settings with public-safe fields and version.
- `pages`: stable key, route, status, published revision, draft revision, timestamps.
- `page_sections`: page, stable section key/type, structured JSON payload, ordering, status.
- `projects`: slug, verified content fields, status, ordering, published revision.
- `project_media`: project/media relationship, role, order, alt text, crop/focal metadata.
- `media`: storage key, MIME, byte size, dimensions, checksum, alt text, processing state, archived state.
- `navigation_items`: location, label, href/route, order, visibility, status.
- `contact_submissions`: name, email, company, subject, message, status, delivery status, source, timestamps.
- `revisions`: entity type/id, snapshot, author, publish state, created time, restore marker.
- `activity_logs`: actor, action, entity, safe metadata, request correlation id, created time.

**API and integration work**

- Typed internal services for CRUD, publish, media processing, leads, and activity logging.
- Contact API stores the lead transactionally, then attempts optional email notification; the UI must distinguish stored-success from notification failure.
- Add a preview token or authenticated preview path; never expose unpublished content through public routes.
- Add cache tags/revalidation for affected public pages after publish.

**Security work**

- Use Argon2id or the hosting-approved password hash; never store plaintext passwords.
- Use opaque, hashed, expiring, revocable sessions in Secure, HttpOnly, SameSite cookies.
- Protect private routes server-side and enforce owner authorization in every mutation service, not only in UI.
- Add login rate limiting, progressive delay/lockout, generic login errors, CSRF/origin checks for cookie-authenticated mutations, secure headers, and no secret-bearing logs.
- Validate all structured content against schemas; escape/render rich text through an allowlist rather than arbitrary HTML.
- Add a honeypot and request throttling to contact submission; keep a safe correlation id for troubleshooting.

**SEO/analytics work**

- Migrate editable SEO fields without changing current public metadata output.
- Define SEO record precedence: page override → site default → generated fallback.
- Use stable content-derived `lastModified` values for sitemap after database migration.
- Keep GA4/Search Console connection screens as disabled/not-connected states only; actual integrations are Phase 2.

**Testing and QA**

- Unit-test schemas, permission checks, publish transitions, session expiry, and contact persistence.
- Integration-test public published reads versus private draft reads, unknown routes, media validation, and rollback of a draft.
- Run typecheck/build, migration from empty database, seed parity against current file content, and smoke tests for every requested private route.
- Run responsive/accessibility checks at the required viewport matrix; verify keyboard navigation, focus visibility, reduced motion, and no public regression.

**Migration considerations**

- Import current `site.ts`, `projects.ts`, project JSON source, and image metadata into draft records; compare normalized output before publishing.
- Keep a repository snapshot and database backup before switching any public content family to database reads.
- Do not delete file-backed source evidence until database parity and rollback are proven.

**Definition of Done**

- Owner can authenticate and reach every Phase 1 private route; unauthenticated users cannot.
- Faisal can edit, save draft, preview, publish, and restore at least pages/sections, projects, navigation, and site settings without editing code.
- Public routes render the same verified content and metadata after database-backed reads are enabled.
- Media upload rejects unsafe/oversized/invalid content and produces usable derivatives with alt text.
- Contact submissions are durably stored and have an auditable delivery state.
- Every mutation is authorized and produces an activity record; secrets never appear client-side.
- Empty/loading/error/mobile states are intentionally designed and verified.

**Explicitly deferred from Phase 1**

GA4 data, Search Console data, health scoring, redirect UI, advanced lead workflows, automated audits, scheduled syncs, AI assistance, blog/Insights CMS, services/Now/Lab modules, multi-user roles, and broad automation.

### Phase 2 — Intelligence: SEO, Analytics, Leads, Health, and redirects

**Objective:** Turn the foundation into an evidence-led operating system for discoverability, measured performance, lead triage, and actionable site health.

**Scope and feature set**

- SEO workspace for title/description/canonical/OG fields, indexability, structured-data preview, internal-link checks, sitemap status, robots status, and content completeness.
- Redirect manager with exact old-path → new-path rules, status code selection limited to safe supported values, conflict detection, loop detection, import/export, and audit history.
- Official GA4 server-side connection and reporting: connection status, property/data-stream setup state, date range, users/sessions/engagement/conversions only when returned by the API, caching, quota/error states, and privacy note.
- Official Search Console server-side connection and reporting: clicks, impressions, CTR, average position, queries/pages/countries/devices, date range, freshness, API quota/error state, and clear distinction from GA4.
- Leads workspace with statuses such as New, Reviewing, Qualified, Won, Archived; search/filter, notes, assignment to the owner, source, email delivery state, export, and retention controls.
- Health Audit workspace with measured checks and heuristic checks separated. Initial checks include HTTP status, metadata completeness, canonical, robots/sitemap, missing alt text, broken internal links, image weight, JSON-LD validity, redirect issues, and public route manifest parity.
- Health scores show methodology, evidence, timestamp, severity, and actionable fix—not an unqualified “100/100.”
- Analytics/SEO dashboard cards use real fetched values or explicit empty/not-connected states; never placeholders that look like live metrics.

**UI/UX deliverables**

- Distinct workspaces for SEO, Analytics, Leads, and Health; no single overloaded dashboard.
- Date-filter controls with timezone/freshness labels, loading skeletons, rate-limit messages, no-data states, and comparison disabled until enough data exists.
- Lead detail panel with readable timeline, status transition, safe notes, and confirmation for archive/delete.
- Audit issue list grouped by severity and type, with “why it matters,” evidence, and route/entity context.
- Mobile-first tables become filterable cards or bottom-sheet detail views; charts remain legible without hover-only information.

**Technical architecture work**

- Add Google API adapters isolated from UI; tokens/refresh credentials stay server-side and are encrypted or protected by the selected secret store.
- Add scheduled/manual sync jobs with idempotent snapshots and provider response timestamps.
- Add a health-check registry so each check is deterministic, versioned, and independently testable.
- Add cache policies: short-lived report cache, longer-lived historical snapshots, private no-store for sensitive lead data.
- Add structured import/export for redirects and leads with validation and audit records.

**Data/database work**

- `seo_metadata`: entity/route, title, description, canonical, robots, OG fields, JSON-LD mode, validation state.
- `redirects`: source, destination, status, enabled, conflict/loop validation, created/updated by.
- `analytics_connections`: provider, account/property identifiers, encrypted credential reference, state, scopes, last sync/error.
- `analytics_snapshots`: provider, report type, date range, dimensions/metrics payload, fetched timestamp, freshness, checksum.
- `search_console_snapshots`: site, report type, date range, dimensions/metrics payload, fetched timestamp, quota/error metadata.
- `health_audits` and `health_findings`: run, check key/version, route/entity, measured value, heuristic result, evidence, severity, status, resolved metadata.
- Extend `contact_submissions` with status history, notes, retention/deletion timestamps, and delivery attempts.

**API and integration work**

- Google OAuth/service-account setup according to the chosen official API flow; least-privilege scopes and disconnect/revoke handling.
- GA4 Data API and Search Console API report endpoints with schema validation, pagination, date limits, retries, backoff, quota handling, and provider error mapping.
- Internal audit endpoints and public-safe health probes; do not expose private reports through public routes.
- Redirect resolution runs before the public fallback and cannot shadow system paths or private routes.

**Security work**

- Encrypt or externalize provider credentials; restrict scopes and display only masked identifiers.
- Re-auth/disconnect invalidates tokens and writes an activity event without logging token values.
- Add per-route authorization checks, export authorization, lead privacy controls, retention/deletion, and safe redaction in activity logs.
- Enforce SSRF-safe health checks: allow only configured same-origin/public URLs, block internal IP ranges, limit response size/time, and do not fetch arbitrary user-provided URLs from the server.
- Add CSRF/origin checks and rate limits to all new mutations and sync triggers.

**SEO/analytics work**

- GA4 is explicitly engagement/behavior data; Search Console is search visibility/query data. Do not merge or label one as the other.
- Show connection state, last successful sync, data freshness, date range, timezone, API errors, quota state, and no-data state.
- Record privacy/consent decisions for any browser-side analytics script; prefer server-side reporting for the private workspace.
- Provide actionable SEO issues with evidence and route context, not generic advice.

**Testing and QA**

- Contract tests for provider adapters with redacted fixtures; no fake values in production UI.
- Test expired tokens, revoked access, quota exhaustion, partial reports, empty ranges, provider downtime, duplicate sync, and cache expiry.
- Test redirect loops/conflicts and every health-check severity state.
- Test lead retention/export/delete authorization and activity history.
- Verify public HTML, sitemap, robots, canonical, JSON-LD, redirects, image alt text, and performance budgets after editable content is enabled.

**Migration considerations**

- Seed SEO records from current metadata and retain generated fallback behavior.
- Backfill the existing contact email path into lead records only where a durable source exists; do not fabricate historical leads.
- Start analytics snapshots from the first successful connection and label historical coverage honestly.

**Definition of Done**

- Faisal can connect/disconnect GA4 and Search Console without exposing secrets and can see provider state and real reports or honest empty/error states.
- SEO fields and redirects can be edited, validated, published, audited, and rolled back.
- Contact submissions are searchable, statused, retained/deleted according to policy, and exportable only to the owner.
- Health audits produce timestamped evidence-backed measured/heuristic findings with actionable fixes.
- Public routes remain crawlable, fast, and visually unchanged except for intentionally published content.
- Provider failure, quota exhaustion, privacy states, and mobile layouts are all handled without fake numbers.

**Explicitly deferred from Phase 2**

AI-generated content or SEO recommendations, automated publishing, multi-user workflows, generalized CRM, campaigns/newsletters, social publishing, full blog/Insights product, semantic search, and predictive analytics.

### Phase 3 — Scale: revisions, automation, backups, monitoring, and future-ready modules

**Objective:** Make Faisal's Room dependable for long-term operation and ready for carefully selected future modules without turning it into a generalized CMS.

**Scope and feature set**

- Full revision browser/diff for pages, sections, projects, SEO, redirects, navigation, and settings; restore creates a new revision rather than rewriting history.
- Activity log explorer with filters, entity timeline, actor/action categories, safe metadata, retention, and export for the owner.
- Backup and recovery workflow: scheduled database backups, media inventory/checksums, backup status, restore runbook, retention policy, off-provider copy, and periodic restore verification.
- System health center: database connectivity, storage, email delivery, Google connections, scheduled jobs, cache/revalidation, error rates, disk/size limits, and last successful checks.
- Automation framework for scheduled health audits, analytics sync, Search Console sync, backup verification, stale draft reminders, and optional lead follow-up reminders. Every job has status, retry/backoff, run history, and pause controls.
- Controlled future-ready modules: Insights/Blog, Services, Now, Lab, Testimonials, and selected experiments only after a content model and evidence policy are approved. These are extension points, not automatic scope.
- Optional AI assistance only as an explicit draft/helper action with human review, source boundaries, provider cost controls, and no automatic public publishing.

**UI/UX deliverables**

- Revision timeline and side-by-side diff that remains readable on mobile through stacked before/after sections.
- System status cards with last checked time, severity, remediation link, and safe failure language.
- Backup/restore screens with clear scope, timestamp, retention, and irreversible-action confirmations.
- Automation run history with pause/resume, retry, next run, and error details.
- Future module templates must inherit the same editorial/product design system and mobile patterns; no generic CRUD scaffolding.

**Technical architecture work**

- Add a durable job runner/scheduler supported by the hosting environment; jobs must be idempotent and observable.
- Add error tracking/structured logs with PII redaction, correlation ids, alert thresholds, and incident links.
- Add backup verification, restore rehearsal, migration rollback strategy, and release version/checkpoint metadata.
- Add feature flags or module registry for future public routes and private workspaces.
- Add a stable API/service versioning policy and a documented deprecation process.

**Data/database work**

- Extend revisions with diff metadata, restore source, and immutable snapshot policy.
- Extend activity logs with retention class and redaction policy.
- Add `scheduled_jobs`, `job_runs`, `backup_runs`, `system_checks`, and `feature_flags`.
- Add future module tables only when the module is approved; avoid a generic arbitrary-schema page builder.

**API and integration work**

- Scheduled official API syncs and health audits with retries, backoff, locking, and duplicate-run protection.
- Backup provider/storage integration with encryption, lifecycle policy, and restore verification.
- Optional notifications to the owner for failed backups, provider disconnects, repeated health regressions, or failed contact delivery; notification noise must be bounded.
- Optional AI adapter remains server-side and draft-only unless a later approval changes the rule.

**Security work**

- Verify backup encryption, least privilege, restore authorization, and separation of production credentials.
- Add alerting for repeated failed logins, suspicious mutation volume, provider disconnects, failed backups, and job abuse.
- Review CSP, security headers, dependency vulnerabilities, secret rotation, session invalidation, and data retention.
- Include a documented incident response and rollback procedure; never expose raw stack traces, provider tokens, or private lead data.

**SEO/analytics work**

- Scheduled rechecks keep sitemap, metadata, redirects, structured data, broken links, and performance findings current.
- Analytics history has retention/aggregation rules and avoids retaining unnecessary raw personal data.
- New public modules receive metadata, canonical, sitemap, internal-link, and structured-data support before publication.

**Testing and QA**

- End-to-end tests for login, draft/publish/restore, media, contact/lead states, integrations, audit logs, scheduled jobs, backups, and recovery.
- Restore rehearsal from a clean environment; verify media references and public route parity.
- Accessibility regression scans, keyboard-only flows, reduced-motion checks, performance budgets, dependency/security scans, and all required responsive viewports.
- Failure-injection tests for database outage, storage outage, email/provider outage, job timeout, expired credentials, and partial publish.

**Migration considerations**

- Keep every schema migration forward-only and reversible through tested backup/restore, not destructive down-migrations in production.
- Introduce future modules one at a time behind a feature flag; each module must have an evidence policy and public/private route decision.
- Preserve public route slugs and add redirects before any URL migration.

**Definition of Done**

- Faisal can inspect and restore content safely, see who/what changed it, and recover the system from a verified backup.
- Scheduled jobs are observable, idempotent, rate-limited, and pausable; failures produce actionable status without leaking secrets.
- System health, integrations, backups, and public SEO checks have honest current states.
- New modules can be added without changing the public design language, auth model, or core content contracts.
- A clean environment can be rebuilt from documented configuration, migrations, seed data, media inventory, and a tested recovery procedure.

**Explicitly deferred from Phase 3 unless separately approved**

Multi-tenant organizations, public user accounts, a full visual canvas/page builder, arbitrary custom code execution, a generalized CRM/marketing automation suite, social publishing, ecommerce/payments, native mobile apps, autonomous AI publishing, and decorative 3D/WebGL experiences.

## 6. Master feature matrix

| Requested capability | Phase | Dependency / acceptance anchor |
| --- | --- | --- |
| Public website preservation | All | Existing routes remain primary; published reads only; regression QA. |
| `/faisals-room` shell and mobile app-like UX | 1 | Private auth and responsive workspace shell. |
| Login, sessions, authorization | 1 | Secure owner account, hashed password, protected mutations. |
| Pages and page sections | 1 | Database seed, draft/publish, revisions extended in 3. |
| Projects and case studies | 1 | Current verified content seeded; media relationships. |
| Project images/gallery | 1 | Media metadata, derivatives, safe upload. |
| Media library | 1 | Object storage/processing, alt text, usage and archive. |
| SEO fields and technical SEO | 2 | SEO records seeded in 1; audit checks and editable fields in 2. |
| Navigation/footer/CTA links | 1 | Structured navigation/settings with publish workflow. |
| Site-wide settings | 1 | Singleton settings, validation, public-safe values. |
| Contact/lead storage | 1 | Durable contact submissions; status workflow in 2. |
| Lead statuses, notes, export, retention | 2 | Owner-only access and audit history. |
| Website health/audit scores | 2 | Versioned measured/heuristic check registry. |
| GA4 | 2 | Official server-side API, consent/privacy, cache/quota states. |
| Search Console | 2 | Official API, separate SEO data model, quota/error states. |
| Redirects | 2 | Conflict/loop validation and safe routing precedence. |
| Draft/publish | 1 | Published-only public reads; preview protected. |
| Revisions/diff/restore | 3 | Immutable snapshots and restore-as-new-revision. |
| Activity/audit logs | 1 foundation, 3 full | Safe mutation records; filters/retention in 3. |
| Security controls | 1 foundation, 2 hardening, 3 operations | Auth, CSRF/rate limiting, upload security, headers, alerts. |
| Performance/accessibility/mobile | All | Public preservation; every new workspace passes viewport/keyboard checks. |
| Backups/recovery | 3 | Encrypted scheduled backups and restore rehearsal. |
| Monitoring/system health | 3 | Service checks, alerts, job status, redacted logs. |
| Insights/Blog, Services, Now, Lab | 3 extension only | Each module requires separate content/evidence approval. |
| AI assistance | 3 optional | Draft-only, human review, cost/source boundaries. |

## 7. Nothing-missed acceptance checklist

### Product and UI

- [ ] Product is named **Faisal's Room** and private routes use `/faisals-room`, never `/admin`.
- [ ] Public website remains the first-class experience and keeps its evidence-first content rules.
- [ ] Dashboard uses dark-sidebar/light-workspace editorial product UI, not a generic admin template.
- [ ] All workspace routes have loading, empty, error, success, and mobile states.
- [ ] Responsive QA covers 360, 375, 390, 430, 768, 1024, 1280, 1440, and 1600px.
- [ ] Semantic HTML, keyboard navigation, visible focus, contrast, alt text, reduced motion, and non-hover alternatives are verified.

### CMS and content

- [ ] Pages, sections, projects, project media, settings, navigation, and SEO records can be managed without code.
- [ ] Draft, preview, publish, revision, and rollback semantics are explicit.
- [ ] Current verified projects and supplied identity images remain truthful and unchanged in meaning.
- [ ] No generic multi-tenant or arbitrary-code page builder is introduced.

### Media

- [ ] Uploads validate content type by bytes, dimensions, size, filename, and image decode.
- [ ] Originals and derivatives are separated; alt text, usage, checksum, archive, and deletion rules exist.
- [ ] Media references are backed up and restore-tested.

### SEO and analytics

- [ ] Editable metadata, canonical, OG, robots, structured data, sitemap, and redirects are validated.
- [ ] GA4 and Search Console use official server-side integrations, distinct data models, secret-safe state, caching, date filters, quota/error/empty states, and privacy handling.
- [ ] Health scores show evidence and distinguish measured values from heuristics.

### Leads and operations

- [ ] Contact submissions are stored before optional email notification and have delivery/status history.
- [ ] Lead access, retention, export, deletion, and audit history are owner-only and privacy-aware.
- [ ] Backups, restore rehearsals, system checks, job runs, monitoring, alerting, and rollback are documented.

### Security

- [ ] Password hashing, secure sessions, authorization, CSRF/origin validation, login throttling, brute-force protection, rate limiting, safe errors, validation, output escaping, security headers, secret management, and redacted audit logs are implemented.
- [ ] Provider credentials never reach browser bundles or logs.
- [ ] SSRF-safe health checks and dangerous-file handling are in place before remote checks/uploads ship.

## 8. Explicitly not included now, and never by default

**Not included now:** Phase 2/3 features before their phase gate, full public Insights/Blog/Services/Now/Lab content, advanced CRM, AI assistance, scheduled automation, multi-user permissions, and payment/ecommerce.

**Not included unless separately approved:** multi-tenant organizations, public accounts, a generalized drag-and-drop canvas, arbitrary custom code in content, social publishing, marketing automation, native apps, autonomous AI publishing, fake analytics, guaranteed health scores, decorative WebGL/3D/particles, autoplay media, sound, scroll hijacking, or any feature unrelated to the personal website/control-center purpose.

These are scope protections, not claims that future product decisions are impossible. A future request must state the user value, data/security implications, migration path, and whether it belongs inside one of the three phases or is a separate product.

## 9. Recommended implementation order and approval gates

1. **Review gate:** Faisal reviews this document, confirms the three phases, and approves Phase 1 only. No code should be written before this approval.
2. **Phase 1 gate:** Confirm hosting/runtime supports the selected database, secure secrets, object storage, and scheduled migration tooling. Provide the later inputs listed below. Implement and validate only Phase 1.
3. **Phase 2 gate:** Review Phase 1 public regression, database parity, auth/security evidence, and backup readiness. Separately approve Google API connections and privacy choices before enabling integrations.
4. **Phase 3 gate:** Review real usage, lead volume, health/audit value, operational burden, and backup restore evidence. Approve automation/future modules individually.

## 10. Later inputs and configuration required

The user will later need to provide or approve the production database/storage choice, one owner login setup method, session/secret management location, media storage/provider choice, email provider/domain and contact recipient, Google Analytics property and Search Console property, Google OAuth/service-account ownership and scopes, privacy/consent wording, retention periods for leads/logs/analytics, backup destination and retention, alert destination, and any approved public modules or content. Secrets should be entered through the chosen hosting secret manager or protected configuration flow, not pasted into repository files or this plan.

## 11. Executive recommendation

Approve the plan as written and begin with Phase 1 only. The current public site is a good visual/content foundation, but adding dashboards before authentication, durable content, publish safety, and data boundaries would create a fragile admin surface. The safest path is a small single-owner control center that first makes the existing site manageable without changing its public personality; then add real intelligence only after official connections and privacy rules are in place; finally add operations and automation only when the system has enough real usage to justify them.

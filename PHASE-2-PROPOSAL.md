# Phase 2 Proposal — Intelligence: SEO, Analytics, Leads, Health, Redirects

**Status:** Proposal only. NOT approved. NO implementation.

## Scope

Build five workspaces inside `/faisals-room`:

1. **SEO Workspace** — Editable metadata (title, description, canonical), robots/indexability toggles, OG fields, structured-data preview, sitemap/robots status, internal-link checks, completeness findings.
2. **Redirect Manager** — URL redirects with safe status codes (301/302/307/308), conflict/loop detection, import/export (CSV), audit history, routing precedence that cannot shadow `/faisals-room/*` or `/api/*`.
3. **GA4 Integration** — Server-side Google Analytics 4 via official API. Property selection, date filters, metrics (sessions, users, pageviews), quota/error/empty states. No fake data.
4. **Search Console Integration** — Separate SEO data product via official API. Clicks, impressions, CTR, position by query/page/device/country. Date filters, freshness indicators.
5. **Lead Inbox** — Workflow states (New → Reviewing → Qualified → Won/Archived), search/filter, notes, delivery history, retention/deletion, owner-only CSV export, activity timeline.
6. **Health Audit** — Evidence-backed checks: HTTP status, metadata presence, canonical correctness, robots/sitemap validity, alt text coverage, broken internal links, image weight, JSON-LD validity, redirect chain issues. Every finding shows method, timestamp, evidence, severity, actionable fix. No 100/100 promises.

## Dependencies

- **Google API access:** GA4 and Search Console require OAuth2 credentials (client ID/secret) with appropriate scopes. Fahim must create Google Cloud project, enable APIs, and approve scopes.
- **Privacy decisions:** Data retention periods for leads and analytics; consent handling for any client-side tracking.
- **Phase 1 stable:** Production database and media storage must remain operational; no breaking schema changes.
- **Secrets management:** Provider credentials encrypted at rest; never in git or logs.

## Risks

1. **Google API quota/expiry:** GA4 and Search Console have daily quotas; tokens expire and need refresh. Mitigation: cache with freshness timestamps, graceful degradation to empty states, clear re-auth flow.
2. **Scope creep on "scores":** Health audit must not promise perfect scores. Mitigation: every finding cites evidence and method; no aggregate 100/100 claims.
3. **Redirect loops:** Misconfigured redirects can break the site. Mitigation: loop detection before save, preview mode, audit log, cannot override system paths.
4. **PII in leads:** Contact form submissions contain personal data. Mitigation: retention policies, owner-only export, redaction in logs, deletion workflow.
5. **SSRF in health checks:** Fetching arbitrary URLs is dangerous. Mitigation: allowlist to own domain only, timeouts, no credential forwarding.

## Deliverables

- [ ] SEO workspace UI + API (`/faisals-room/seo`)
- [ ] Redirect manager UI + API with loop detection
- [ ] GA4 connector (OAuth flow, property picker, dashboard widgets)
- [ ] Search Console connector (OAuth flow, query/page reports)
- [ ] Lead inbox UI with 5-state workflow + export
- [ ] Health audit engine + results UI with evidence
- [ ] Database migrations for new tables (redirects, provider_tokens, lead_notes, audit_runs)
- [ ] Updated `FAISALS-ROOM-TODO.md` with Phase 2 completion
- [ ] Phase 2 handoff report with test evidence

## Acceptance Criteria

- [ ] SEO metadata edits save and reflect in page `<head>` after publish
- [ ] Redirects work without loops; system paths cannot be overridden
- [ ] GA4 shows real data from connected property OR honest empty/error state (never fake)
- [ ] Search Console shows real query data OR honest empty/error state
- [ ] Lead state transitions work; export contains only owner-authorized fields
- [ ] Health audit findings each show: check method, timestamp, evidence, severity, fix suggestion
- [ ] Provider token expiry shows re-auth prompt, not crash
- [ ] All new routes protected by owner auth; anonymous → 307
- [ ] `pnpm typecheck`, `pnpm test`, `next build` pass
- [ ] No PII in logs; secrets encrypted

---

**Approval required before any implementation.** Phase 2 requires separate approval for Google API ownership/scopes and privacy/consent decisions per the master blueprint.

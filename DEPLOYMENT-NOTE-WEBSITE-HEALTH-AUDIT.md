# Deployment Note — Website Health Audit Engine (Phase 2)

**Branch:** `feat/website-health-audit`
**Commit:** `233f6b1`
**ZIP:** `faisalhossen-health-audit.zip` (9.8 MB, SHA-256 `83d9662838d6794d…`)

---

## 1. Pre-deployment

- Deploy with the standard Hostinger ZIP source-upload flow
  (Add Website → Deploy Web App → Upload ZIP).
- **Migration required:** `db/migrations/0006_health_audits.sql`
  creates two additive tables: `health_audits` and `health_findings`.
  Run it once via your DB client (phpMyAdmin or mysql CLI).
  No existing tables are altered.
- **No new environment variables required.**
- **No production deployment by the agent** — owner deploys manually.

## 2. What was added

- `lib/server/health/safe-fetch.ts` — SSRF-protected HTTP client
  (http/https only, public-IP validation, DNS pinning, 10s timeout,
  2MB cap, manual redirect re-validation, max 5 hops).
- `lib/server/health/checks.ts` — evidence-based checks (SEO,
  accessibility, security headers, crawlability). Each finding carries
  category, severity, URL, evidence, recommended fix, method
  (measured/heuristic), timestamp.
- `lib/server/health/audit.ts` — on-demand orchestration
  (max 10 pages: homepage + depth-1 internal links; robots.txt and
  sitemap.xml checks; broken internal link detection).
- `app/api/faisals-room/health/audits/route.ts` — GET history,
  POST run audit (owner-only, same-origin CSRF, 5 audits/hour limit).
- `app/api/faisals-room/health/audits/[id]/route.ts` — GET audit detail.
- `app/faisals-room/system/health/` — dashboard (run audit, filters,
  findings, history); linked from the System workspace page.

## 3. Crawl limits (conservative, documented in-app)

- Max 10 pages per audit, depth 1 from homepage, sequential fetches
- 10s timeout per request, 2MB response cap, max 5 redirects
- Ports 80/443 only; private/loopback/link-local/metadata IPs blocked
- Audits run synchronously in the POST request (can take up to ~60s)

## 4. Verification done (not deployed)

- 28 new tests, all pass; combined suite: 152 total, 108 pass,
  0 fail, 44 skipped (DB integration, no test DB).
- `tsc --noEmit` clean; `npm run build` clean.
- No changes to GA4, Search Console, Redirect Manager, or Lead Inbox.

## 5. Known limitations

- Findings are evidence-based; unexecuted checks are never reported
  as passed. No aggregate "SEO score".
- HTML parsing is regex-based (no JS execution by design) —
  heuristic findings are labeled as such.
- No performance measurements (Lighthouse-style) — only reliable,
  directly observable facts.
- Synchronous audits: long audits may approach HTTP timeout limits
  on some hosts; limits are intentionally conservative.

## 6. Rollback

The migration is additive. Manual rollback:
```sql
DROP TABLE IF EXISTS health_findings;
DROP TABLE IF EXISTS health_audits;
DELETE FROM schema_migrations WHERE name = '0006_health_audits.sql';
```
Redeploy the previous ZIP to remove the feature code.

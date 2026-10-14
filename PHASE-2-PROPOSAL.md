# Phase 2 Proposal — Intelligence: SEO, Analytics, Leads, Health, Redirects

**Status:** Revised proposal. NOT approved for implementation. Planning only.

**Phase 1:** Closed as "Implementation Complete — Accepted with Documented Limitations" (commit 9d138dc). All six Phase 1 limitations preserved below.

---

## 1. Revised Scope and Architecture

### Architecture Principle: CONTENT_SOURCE=files Preserved

The public portfolio continues to read from checked-in files. **No database-to-public publishing pipeline is added in Phase 2.** The SEO workspace operates in **planning/editing/preview mode only**:

- **Planning:** Draft SEO metadata changes, compare against current live values, track completeness
- **Editing:** Modify title, description, canonical, OG fields, robots directives in the dashboard (stored as drafts in database)
- **Preview:** Render a preview showing exactly what the `<head>` *would* contain if the changes were applied to files. Preview is a simulated rendering — it does NOT change the live site.

A separate approved migration plan would be required to switch public reads to database or add a file-generation pipeline. That is out of scope.

### Workspaces (6)

#### 1. SEO Workspace (`/faisals-room/seo`)
- Editable metadata drafts: title, meta description, canonical URL, robots (index/noindex, follow/nofollow)
- OG fields: og:title, og:description, og:image, og:type, twitter:card
- Structured-data (JSON-LD) preview with syntax validation
- Sitemap/robots.txt status viewer (read-only, reflects live files)
- Internal-link checker (crawl own domain, report broken links)
- Completeness findings: which pages lack description, OG image, canonical, etc.
- **Preview mode:** Side-by-side "Current live" vs "Draft" `<head>` comparison
- **Explicit banner:** "Changes are drafts. Public site uses files. No auto-publish."

#### 2. Redirect Manager (`/faisals-room/redirects`)
- CRUD for redirects: source path → target URL, status code (301/302/307/308)
- **CSV import/export** with schema validation (see Data Model)
- Loop detection: reject self-redirects; reject chains exceeding depth 5
- Conflict detection: duplicate source paths flagged with actionable row-level error reports
- **Protected paths:** Cannot create redirects for `/faisals-room/*` or `/api/*` (blocked at validation)
- Audit history: who created/modified/disabled each redirect, when
- **Disable (not delete):** Redirects are disabled rather than deleted, preserving history; re-enable supported
- **Rollback:** Bulk disable switch; per-redirect revert to previous version from audit log
- **Production activation:** Redirects do NOT auto-activate. A separate approved release procedure is required before any redirect goes live.

#### 3. GA4 Integration (`/faisals-room/analytics`)
- Server-side only. **No client-side gtag.js, no tracking cookies in Phase 2.**
- OAuth2 with read-only scope: `https://www.googleapis.com/auth/analytics.readonly`
- Property picker, date range selector (7/30/90 days)
- Metrics: sessions, total users, pageviews, top pages (from API, never fabricated)
- Cache: 90-day retention, `fetched_at` timestamp displayed, stale-data badge if >24h old
- States: connected / not connected / quota exceeded / token expired (re-auth prompt) / API error — all honest, no fake zeros

#### 4. Search Console Integration (`/faisals-room/seo` — Search Console tab)
- Server-side only via official API
- OAuth2 with read-only scope: `https://www.googleapis.com/auth/webmasters.readonly`
- Dimensions: query, page, device, country
- Metrics: clicks, impressions, CTR, average position
- Date range, freshness indicator, same honest state handling as GA4
- Separate from GA4: independent connect/disconnect, independent token

#### 5. Lead Inbox (`/faisals-room/leads`)
- Five-state workflow: New → Reviewing → Qualified → Won / Archived
- Search, filter by state/date, notes thread per lead
- Delivery history (was Resend notification sent? honest status)
- **Retention:** 24 months from submission, then automatic deletion per documented workflow
- **Owner-triggered deletion:** Supported at any time; confirmation required
- **Export:** Owner-only CSV; **IP address and user-agent excluded by default**
- **Deletion audit:** Log who deleted what and when; note that backups may retain data beyond deletion (documented limitation)
- Activity timeline per lead

#### 6. Health Audit Engine (`/faisals-room/system` — Health tab)
- **On-demand only.** No scheduled runs in Phase 2.
- Checks: HTTP status, metadata presence, canonical correctness, robots.txt validity, sitemap validity, alt text coverage, broken internal links, image weight (total KB per page), JSON-LD syntax, redirect chain issues, **route-manifest parity** (deployed routes vs expected)
- Each finding: check name, method (measured/heuristic), timestamp, evidence (URL + snippet), severity (error/warning/info), actionable fix suggestion
- **No aggregate scores.** No "SEO score: 87/100." Individual findings only.
- Clear distinction: "Measured" (HTTP status 200) vs "Heuristic" (alt text could be more descriptive)

---

## 2. Data Model and Migration Plan

### New Tables

```sql
-- SEO drafts (planning only, not live)
seo_drafts (id, page_path, field_name, draft_value, live_value, updated_by, updated_at)

-- Redirects
redirects (id, source_path UNIQUE, target_url, status_code, is_active, created_by, created_at, updated_at)
redirect_audit (id, redirect_id, action, old_value, new_value, actor, timestamp)

-- OAuth provider tokens (encrypted)
provider_tokens (id, provider ENUM('ga4','search_console'), encrypted_access_token, encrypted_refresh_token, token_expiry, property_id, connected_by, connected_at, last_refresh_at)

-- Lead notes (extends existing leads table)
lead_notes (id, lead_id FK, note_text, created_by, created_at)

-- Health audit runs (on-demand)
audit_runs (id, triggered_by, started_at, completed_at, status, findings_json)
```

### Migration Strategy
- Additive only. No modifications to existing Phase 1 tables.
- Each migration includes `DOWN` script for rollback.
- `provider_tokens` uses AES-256-GCM encryption (see Section 3).

### CSV Schema (Redirect Import/Export)
```csv
source_path,target_url,status_code,is_active
/about/me,https://example.com/about,301,true
/old-page,/new-page,302,false
```
- Validation: source_path must start with `/`, must not match `/faisals-room/*` or `/api/*`; target_url must be valid URL or path; status_code in (301,302,307,308)
- Duplicate source_path in file → row rejected with message "Row 5: duplicate source_path '/about/me'"
- Invalid rows reported with row numbers; valid rows still imported

---

## 3. Security and Privacy Controls

### Token Encryption (AES-256-GCM)
- **Key:** Dedicated 256-bit key via server-side env var `OAUTH_ENCRYPTION_KEY` (base64-encoded 32 bytes)
- **Key validation:** On startup, verify key is 32 bytes; log error and disable provider features if invalid/missing (fail closed)
- **Nonce:** 96-bit random nonce per encryption, stored alongside ciphertext
- **Auth tag:** 128-bit GCM tag verified on decrypt; tampered data rejected
- **Rotation:** New key via env var; re-encrypt existing tokens on next refresh; old key retained as `OAUX_ENCRYPTION_KEY_PREVIOUS` for one rotation cycle
- **Recovery:** If key lost, tokens undecryptable → user must disconnect and reconnect (documented)
- **Redaction:** Tokens never in logs, never in API responses, never in browser code

### PII Protection
- Lead PII (name, email, message) encrypted at rest? **Decision:** Same as Phase 1 (database-level; no additional encryption unless owner requests)
- **Logs:** No PII in application logs. Email addresses redacted as `j***@example.com` in audit trails.
- **Exports:** IP and user-agent excluded by default. Owner can request inclusion with explicit confirmation (logged).
- **Backups:** Document that database backups retain deleted lead data until backup retention expires. Deletion from live DB does not equal deletion from backups.

### API Security (all new routes)
- Owner authentication required (existing Phase 1 session)
- CSRF/origin validation (existing Phase 1 middleware)
- Rate limiting: 60 requests/minute per session for API routes (reuse Phase 1 throttle)
- Input validation: Zod schemas for all request bodies; reject oversized payloads (>1MB)
- Anonymous access → 307 redirect to login (consistent with Phase 1)

### SSRF Protection (Health Audit)
- Only fetch URLs on own domain (`faisalhossen.com`)
- Timeout: 10 seconds per request
- No credentials/cookies forwarded
- Maximum 50 URLs per audit run

---

## 4. Testing and Acceptance Criteria

### Per-Workspace Criteria

**SEO Workspace:**
- Functional: Draft saves; preview shows accurate `<head>` diff; completeness findings correct
- Security: Anonymous → 307; CSRF blocked; no DB-to-public leak
- Accessibility: Form labels, keyboard navigable, focus visible
- Responsive: Usable at 360px (single column) and 1280px
- Regression: Public pages unchanged after SEO draft saves

**Redirect Manager:**
- Functional: CRUD works; CSV import validates rows; loop detection blocks; chain depth enforced
- Security: Cannot create `/faisals-room/*` or `/api/*` redirects; audit log immutable
- Accessibility: Table keyboard navigable; error messages announced
- Responsive: Table → cards at mobile
- Regression: Existing routes unaffected when redirects disabled

**GA4 / Search Console:**
- Functional: OAuth flow completes; real data displays; disconnect works
- Security: Tokens encrypted; never in browser; scopes are read-only
- Accessibility: Charts have text alternatives; date picker keyboard usable
- Responsive: Metrics grid collapses at mobile
- Regression: Dashboard loads with providers disconnected (empty states)

**Lead Inbox:**
- Functional: State transitions work; notes save; export generates CSV; deletion works with confirmation
- Security: Owner-only; export excludes IP/UA by default; PII redacted in logs
- Accessibility: Workflow buttons labeled; timeline screen-reader friendly
- Responsive: Inbox list → detail view at mobile
- Regression: Contact form still submits; new leads appear as "New"

**Health Audit:**
- Functional: On-demand run completes; findings show method/timestamp/evidence/severity/fix; route-manifest parity checked
- Security: Only own domain fetched; timeouts enforced
- Accessibility: Results table keyboard navigable; severity indicated by text not just color
- Responsive: Findings list usable at 360px
- Regression: Audit does not modify any data

### Global Criteria
- `pnpm typecheck` passes
- `pnpm test` passes (8/8 existing + new tests)
- `next build` succeeds
- No PII in logs (verified by log inspection)
- Performance: Dashboard pages load <2s (server-rendered)
- All new database migrations have DOWN scripts

### Honest States (never fake)
- Not connected: "Connect GA4 to see analytics"
- Quota exceeded: "API quota exceeded. Data from [date]. Retry tomorrow."
- Token expired: "Session expired. Reconnect to continue."
- No data: "No queries in selected date range" (not zeros)
- Stale: "Data from [date] — may be outdated" badge

---

## 5. Dependencies and Owner Actions

| # | Action | Owner | Timing |
|---|--------|-------|--------|
| 1 | Resolve CONTENT_SOURCE decision | Done (Option C) | — |
| 2 | Create Google Cloud project | **You** | Before implementation |
| 3 | Enable Analytics Data API | **You** | Before implementation |
| 4 | Enable Search Console API | **You** | Before implementation |
| 5 | Create OAuth2 credentials (web app) | **You** | Before implementation |
| 6 | Configure authorized redirect URI | **You** | During implementation |
| 7 | Approve OAuth scopes in browser | **You** | After deployment |
| 8 | Set `OAUTH_ENCRYPTION_KEY` in hPanel | **You** | Before deployment |
| 9 | Confirm lead retention (24 months) | Done (approved) | — |
| 10 | Confirm no client-side tracking | Done (approved) | — |

**I will NOT:** Create Google Cloud resources, initiate OAuth flows, or handle credentials on your behalf.

---

## 6. Rollback and Release Plan

### Rollback Strategy
1. **Database:** Each migration has DOWN script. Rollback = run down migrations in reverse order.
2. **Code:** New routes are additive. Rollback = redeploy previous release (no DB dependency for basic function).
3. **Redirects:** If activated and causing issues → bulk disable switch in dashboard; or redeploy with redirects table truncated.
4. **Provider tokens:** Disconnect from Settings → tokens deleted; re-connect when ready.

### Release Plan
1. Implement on feature branch
2. Local: typecheck, test, build pass
3. PR review, merge to main
4. Create source ZIP (same process as Phase 1)
5. Deploy to Hostinger via ZIP upload
6. Verify: new routes 200 (authenticated), anonymous 307
7. **Do NOT activate redirects** without separate approval
8. Owner connects GA4/Search Console via browser OAuth flow

### What Does NOT Roll Back Automatically
- Database migrations (require manual DOWN)
- Uploaded media (Phase 1)
- Sent lead notification emails (if any)

---

## 7. Remaining Decisions and Legal/Privacy Questions

### Decisions (need your answer before implementation)
1. ☐ **Confirm:** SEO workspace is planning-only (Option C). No database-to-public publishing in Phase 2. ✅ *You approved this.*
2. ☐ **Confirm:** OAuth scopes as specified (readonly). ✅ *You approved this.*
3. ☐ **Confirm:** 24-month lead retention, owner-triggered deletion, IP/UA excluded from exports. ✅ *You approved this.*
4. ☐ **Confirm:** 90-day analytics cache, no client-side tracking. ✅ *You approved this.*
5. ☐ **Confirm:** CSV for redirect import/export. ✅ *You approved this.*
6. ☐ **Confirm:** AES-256-GCM via `OAUTH_ENCRYPTION_KEY` env var. ✅ *You approved this.*

### Legal/Privacy Questions (recommend legal review)
1. **GDPR/data protection:** Does 24-month lead retention comply with applicable data protection laws for your jurisdiction? Are you the data controller?
2. **Backup deletion:** Backups retain deleted data. Is this disclosed in your privacy policy?
3. **Google data:** GA4/Search Console data cached for 90 days. Does this require updating your privacy policy?
4. **Lead export:** CSV exports contain PII. How are exported files secured after download?
5. **Right to erasure:** If a lead requests deletion, does 24-month auto-deletion satisfy, or is immediate deletion required?

**Recommendation:** Consult applicable privacy regulations before collecting lead data under the 24-month policy.

---

## Phase 1 Limitations Preserved

All six Phase 1 verification limitations remain documented and unchanged:
1. Skip-link keyboard Tab behavior untested
2. Media original file not separately verified
3. Media WebP derivatives not individually verified
4. Media survival across release change not tested
5. Six viewport widths code-audited only (1280px live-verified)
6. Mobile hamburger menu not click-tested

---

**This proposal is for review only. No implementation authorized. Awaiting explicit Phase 2 implementation approval.**

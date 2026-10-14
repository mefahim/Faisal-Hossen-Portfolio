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

**Phase 2 scope is planning-only.** The redirect manager supports drafting, validation, preview, CSV import/export, and audit history. **Production redirect activation is disabled in Phase 2** and requires a separate approved release procedure.

- CRUD for redirect drafts: source path → target URL, status code (301/302/307/308)
- **CSV import/export** with schema validation (see Data Model)
- Loop detection: reject self-redirects; reject chains exceeding depth 5
- Conflict detection: duplicate source paths flagged with actionable row-level error reports
- **Protected paths:** Cannot create redirects for `/faisals-room/*` or `/api/*` (blocked at validation)
- Audit history: who created/modified/disabled each redirect, when
- **Disable (not delete):** Redirects are disabled rather than deleted, preserving history; re-enable supported
- **Rollback:** Bulk disable switch; per-redirect revert to previous version from audit log

**Inactive state representation:**
- UI: Prominent banner — "Redirects are drafts. They do not affect public traffic until activated under a separate approved release." Each redirect row shows status: `Draft` / `Validated` / `Ready` (never `Active` in Phase 2).
- API: No middleware or route handler evaluates the `redirects` table. Imported rules are stored only. A `GET /api/faisals-room/redirects/preview?path=/x` endpoint returns what *would* happen (for testing), without performing the redirect.
- Database: `is_active` column exists but is ignored by all request handling in Phase 2. A future migration would wire activation.

**Owner decisions (confirmed):**
- Target URLs: root-relative paths or absolute `https://` URLs only. No `http://`, no protocol-relative, no other schemes.
- CSV import: duplicate `source_path` rows are rejected; existing database rules are never silently overwritten.
- CSV import request body: JSON `{ "csv": "..." }` (not multipart).
- Planning-only throughout Phase 2. No production activation or public traffic evaluation without separate explicit approval.

**URL normalization (applied identically to create, update, CSV import, and audit revert):**
- Trailing slashes: preserved as written. `/about` and `/about/` are distinct source paths. No silent stripping or appending.
- Query strings: preserved as written in both source and target. `/page?a=1` and `/page?a=2` are distinct. Query strings are never dropped.
- Percent-encoding: validated but not re-encoded. Invalid sequences (e.g., lone `%`) are rejected. `%2F` and `/` are treated as distinct — no silent decoding.
- Case sensitivity: paths are case-sensitive. `/About` and `/about` are distinct source paths.
- Absolute HTTPS URLs: hostname lowercased (per RFC); path, query, and fragment preserved exactly. Default port `:443` notation is rejected as non-canonical — use bare hostname.
- Normalization never changes the meaning of a path silently. If two inputs normalize to the same value, the later one is rejected as a duplicate with an explanatory message.

**Uniform validation across all write paths:**
Create, update, CSV import, and audit revert all run the same validation pipeline: schema check → protected-path check → self-redirect check → loop detection (graph cycle check against current rules plus the proposed change) → chain-depth check (max 5 hops). Any failure rejects the operation.

**Audit revert safety:**
- Revert validates the proposed restored state through the full pipeline before writing.
- If validation fails, the revert fails atomically: the transaction rolls back, current rules are unchanged, and the error names the specific failed check.
- Successful reverts create a new audit entry (action `reverted`, referencing the source audit ID). History is append-only.

**CSV import transactional behavior:**
- Each row is validated independently before any write.
- Valid rows are inserted in a single transaction; if any insert fails (e.g., race-condition duplicate), the entire import rolls back and the error is reported — no partial writes.
- Each successfully imported row creates one `redirect_audit` entry (action `imported`).
- Rejected rows (validation failure, in-file duplicate, DB duplicate) produce no audit entries and do not affect the transaction.
- Response: `{ imported: number, rejected: [{ row, source_path, errors: string[] }] }`.

**Bulk disable safety:**
- `POST /api/faisals-room/redirects/bulk-disable` sets `is_active = FALSE` for all rows in one transaction.
- Creates a single audit entry with `redirect_id = NULL`, action `bulk_disabled`, and `new_value: { affected_count }`.
- Reversal: `POST /api/faisals-room/redirects/bulk-enable` restores each rule's prior `is_active` value from its most recent audit snapshot (not blanket `TRUE`). Each restoration is individually auditable.

**Concurrency protection:**
- `source_path` has a `UNIQUE` constraint at the database level — the single source of truth for duplicate prevention.
- Create/update/import handlers use `INSERT ... ON DUPLICATE KEY UPDATE`-free logic: attempt `INSERT`, catch duplicate-key error, return a 409 with `"source_path already exists"`. No check-then-insert race.
- Concurrent duplicate creation attempts: exactly one succeeds; others receive 409. No silent overwrite, no lost update.

**Preview endpoint guarantee:**
- `GET /api/faisals-room/redirects/preview?path=` always returns HTTP 200 with JSON for valid requests.
- Response: `{ would_redirect: boolean, target: string | null, status_code: number | null, chain: string[], planning_only: true }`.
- The endpoint never issues an HTTP 3xx redirect under any circumstance. Verified by test asserting response status is 200 and no `Location` header is present.

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

-- Redirects (planning-only in Phase 2; no public traffic evaluation)
redirects (id CHAR(36) PK, source_path VARCHAR(500) NOT NULL UNIQUE, target_url VARCHAR(2000) NOT NULL,
  status_code SMALLINT NOT NULL CHECK IN (301,302,307,308), is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by CHAR(36) NOT NULL, created_at DATETIME(3), updated_at DATETIME(3))
-- Uniqueness enforced at DB level (UNIQUE constraint). Application uses INSERT-catch-duplicate
-- (never check-then-insert) so concurrent duplicate creation is safe: exactly one succeeds, others get 409.
redirect_audit (id CHAR(36) PK, redirect_id CHAR(36) NULL, action VARCHAR(40) NOT NULL,
  old_value JSON NULL, new_value JSON NULL, actor_id CHAR(36) NOT NULL, created_at DATETIME(3),
  INDEX on redirect_id)
-- Actions: created, updated, disabled, enabled, deleted, imported, reverted, bulk_disabled, bulk_enabled.
-- Append-only; no delete endpoint. redirect_id NULL for bulk actions.

**Migration:** `db/migrations/0002_redirects.sql` (additive only; no changes to existing tables).
**Manual rollback** (migration runner has no DOWN support):
```sql
DROP TABLE IF EXISTS redirect_audit;
DROP TABLE IF EXISTS redirects;
DELETE FROM schema_migrations WHERE name = '0002_redirects.sql';
```

-- OAuth provider tokens (encrypted)
provider_tokens (id, provider ENUM('ga4','search_console'), encrypted_access_token, encrypted_refresh_token, token_expiry, property_id, connected_by, connected_at, last_refresh_at)

-- Lead notes (extends existing leads table)
lead_notes (id, lead_id FK, note_text, created_by, created_at)

-- Health audit runs (on-demand)
audit_runs (id, triggered_by, started_at, completed_at, status, findings_json)

-- Deletion tombstones (pseudonymous; see Section 3)
deletion_tombstones (id, record_hash CHAR(64), entity_type ENUM('lead'), deleted_at, reason ENUM('manual','expiry','restore_reconcile'), purged_at NULL)
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
- **Import request format:** JSON body `{ "csv": "<csv text>" }`, max 256KB (~2,000 rows). Not multipart.
- Validation: source_path must start with `/`, must not match `/faisals-room/*` or `/api/*`; target_url must be a root-relative path or absolute `https://` URL; status_code in (301,302,307,308).
- Duplicate source_path in file → row rejected with message "Row 5: duplicate source_path '/about/me'".
- source_path already in database → row rejected with "Row 5: '/about/me' already exists — edit or delete it first". Never silently overwritten.
- Invalid rows reported with row numbers; valid rows still imported (all-or-nothing per transaction; see Redirect Manager section).
- CSV parsing handles: UTF-8 BOM (stripped), quoted fields with embedded commas/newlines, CRLF and LF line endings. Unclosed quotes or malformed rows are rejected with row numbers.

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

### Deletion Tombstones and Salt Management

**Tombstones are pseudonymous, not anonymous.** A tombstone contains `SHA-256(lead_id + DELETION_SALT)`. The hash cannot be reversed to recover the lead ID without the salt, but anyone possessing both a lead ID and the salt can verify whether that lead was deleted. Tombstones must be treated as personal data for retention and access-control purposes until qualified legal counsel advises otherwise.

**Durability across backup restores — the core problem:** If tombstones live in the same database as leads, restoring an older backup also restores the older tombstone table, losing records of deletions that happened after the backup was taken. Three approaches compared:

| Approach | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Same-DB tombstones | `deletion_tombstones` table in the main database | Simple; transactional with deletes; covered by existing migrations | Lost on restore of older backup — the exact failure mode we're solving | **Insufficient alone** |
| B. Backup-excluded durable store | Separate table/file excluded from backup rotation | Tombstones survive any restore | Hostinger shared hosting: no confirmed mechanism to exclude a table from automated backups; would require manual export/import discipline | **Not feasible** without Hostinger support confirmation (see verification tasks) |
| C. Separately protected deletion ledger | Tombstones exported to an append-only file (e.g., `deletion-ledger.jsonl`) stored outside the database directory, backed up on a different schedule or retained locally with checksums | Survives DB restore; tamper-evident via hash chain; no external service needed | Requires file-system writes from the app; ledger must itself be backed up; reconciliation is a manual/semi-automated step after restore | **Recommended** |

**Recommended design (Approach C):**
- On every lead deletion, append one line to the ledger: `{"hash": "abc…", "deleted_at": "…", "reason": "manual|expiry", "prev": "prior_line_hash"}`. The `prev` field creates a tamper-evident hash chain.
- Ledger file lives at a path outside the database dump scope (e.g., alongside application config, not in the DB data directory). It is included in file-level backups but on an independent cadence from DB dumps.
- After any DB restore: run reconciliation — for each lead in the restored DB, compute its hash and check the ledger; re-delete matches; report counts to the owner. Documented as a required post-restore step, not automatic.

**`DELETION_SALT` requirements:**
- **Generation:** 256-bit random value, base64-encoded, generated once at setup.
- **Storage:** Server-side environment variable only. Never in git, logs, backups of code, or browser-accessible locations.
- **Backup:** Recorded in the owner's secure credential store (same place as `OAUTH_ENCRYPTION_KEY`). Loss of the salt makes all existing tombstones unverifiable — reconciliation after restore becomes impossible.
- **Access control:** Readable only by the application runtime. Not exposed via any API, admin UI, or error message.
- **Rotation strategy:** Dual-salt rotation. On rotation: (1) set `DELETION_SALT_NEW`; (2) re-hash all active tombstones with the new salt in a migration; (3) promote `DELETION_SALT_NEW` → `DELETION_SALT`; (4) retain the old salt as `DELETION_SALT_PREVIOUS` for one tombstone-retention cycle (25 months) to verify any stragglers. Never rotate without completing the re-hash — silently orphaned tombstones are a data-loss risk.
- **Recovery:** If the salt is lost and no backup exists, tombstones cannot be verified. Documented fallback: treat all restored leads as "possibly deleted" and require owner manual review. This is a degraded mode, not a normal path.

**Tombstone retention:** 25 months (24-month lead retention + 1-month reconciliation buffer), then purged. After purge, only k≥5 aggregates remain (see below).

### Deletion Aggregates

**k≥5 is a proposed disclosure safeguard only.** It is not a claim that the resulting data is anonymous, and it is not a claim of GDPR compliance.

- After tombstone purge (25 months), the system may retain counts: e.g., "Q1 2027: 12 leads deleted (3 manual, 9 expiry)."
- Any time bucket with fewer than 5 deletions is merged into the adjacent bucket or reported as "fewer than 5" — never as an exact small number.
- **Time-bucket merging can itself reveal information.** Example: if Q1 shows "fewer than 5" and Q1+Q2 merged shows "7", an observer can infer Q2 had at least 3. Merging reduces but does not eliminate inference risk. Document this limitation.
- Whether k≥5 aggregates satisfy erasure or anonymization requirements under applicable law is **left to qualified legal counsel**. The proposal makes no compliance claim.

### PII Protection
- Lead PII (name, email, message) encrypted at rest? **Decision:** Same as Phase 1 (database-level; no additional encryption unless owner requests)
- **Logs:** No PII in application logs. Email addresses redacted as `j***@example.com` in audit trails.
- **Exports:** IP and user-agent excluded by default. Owner can request inclusion with explicit confirmation (logged).
- **Backups:** Document that database backups retain deleted lead data until backup retention expires. Deletion from live DB does not equal deletion from backups.

### API Security (all new routes)
- Owner authentication required (existing Phase 1 session)
- CSRF/origin validation (existing Phase 1 middleware)
- Rate limiting (see Rate Limiting Design below)
- Input validation: Zod schemas for all request bodies; reject oversized payloads (>1MB)
- Anonymous access → 307 redirect to login (consistent with Phase 1)

### Rate Limiting Design

**Proposed values (not verified requirements):** 120 requests/minute per authenticated session; 10 requests/minute per IP for unauthenticated requests.

**Approach comparison (single-instance shared hosting):**

| | In-memory + DB sync (proposed) | DB-backed sliding window |
|---|---|---|
| Accuracy | Approximate; up to 60s stale | Exact |
| Restart behavior | Counters reset on restart (acceptable: brief permissive window) | Survives restart |
| Concurrent requests | Race conditions possible; use atomic increments | Transaction-safe |
| Multiple workers | Each worker has separate counters (under-counts) | Shared state (correct) |
| DB load | Low (periodic flush) | Higher (write per request) |
| Complexity | Medium | Low |

**Recommendation:** Database-backed sliding window. Rationale: Hostinger runs a single Node instance (no multi-worker concern confirmed — see verification tasks); correctness outweighs the modest DB write cost for an owner-only dashboard. Reuse Phase 1 `rate_limits` table pattern.

**Session lifecycle:**
- Authenticated: bucket keyed by session ID. 120/min sliding window.
- Expired session: falls back to unauthenticated IP bucket (10/min).
- Recreated sessions: new session = new bucket. Abuse vector: attacker creates many sessions. Mitigation: if >5 new sessions from one IP in 10 minutes, apply IP-level cap of 30/min (not a block).
- **Shared NAT safety:** Never permanently block an IP. Blocks are time-limited (max 1 hour), application-level only, with automatic expiry. Owner can clear blocks from dashboard (minimum state: `blocked_ips` table with `ip`, `blocked_until`, `reason`).

**Recovery/unblock path:** Blocked IPs see HTTP 429 with `Retry-After`. Owner dashboard shows active blocks with one-click "Unblock." Blocks auto-expire. No manual SSH intervention required.

### SSRF Protection (Health Audit)

**Design principle:** Defense in depth. "Own domain only" is enforced through seven layers. Hostname validation alone is not sufficient.

1. **URL parsing:** Use WHATWG URL parser. Reject if protocol is not `https` (allow `http` only when `NODE_ENV=development`); reject URLs containing credentials (`user:pass@host`); reject explicit non-standard ports.
2. **Hostname allowlist:** Exact match against `faisalhossen.com` and `www.faisalhossen.com` only. Reject lookalikes (`faisalhossen.com.evil.com`, `evilfaisalhossen.com`), other subdomains, and IP literals.
3. **DNS pinning (no second resolution):** Resolve the hostname to an IP address **once** using `dns.lookup()`. Pass the resolved IP directly to the HTTP client (via `lookup` override or custom agent `createConnection`), so the client does not perform its own DNS resolution. This prevents TOCTOU/DNS-rebinding between validation and connection. If safe pinning cannot be guaranteed, **fail closed** (abort the fetch, log the reason).
4. **IP range blocklist (IPv4 and IPv6):** After resolution, reject if the IP falls in: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private); `127.0.0.0/8` (loopback); `169.254.0.0/16` (link-local); `0.0.0.0/8`; `::1/128` (IPv6 loopback); `fe80::/10` (IPv6 link-local); `fc00::/7` (IPv6 unique-local); `::ffff:0:0/96` (IPv4-mapped IPv6 — unwrap and re-check the embedded IPv4 address against the IPv4 blocklist). Also reject alternate representations: decimal (`http://2130706433/`), octal (`http://0177.0.0.1/`), hex (`http://0x7f.0x0.0x0.0x1/`), and mixed forms — normalize via the URL parser before checking.
5. **Redirect validation:** Maximum 3 redirects. Each redirect target independently passes layers 1–4. Same-host restriction: redirect to a different hostname is rejected. Fail closed if any redirect target cannot be safely pinned.
6. **Connection constraints:** 10-second connect timeout, 10-second read timeout. Maximum response body 5 MB — abort and discard if exceeded. No cookies, no `Authorization` headers, no client IP forwarding. On timeout or abort: destroy the socket, release the connection back to the pool (or destroy the agent), log the URL and reason, record the finding as "unreachable (timeout)" rather than retrying.
7. **Run limits:** Maximum 50 URLs per audit run. If the sitemap lists more, process the first 50 and record "50 of N URLs checked."

**Compatibility note:** This design assumes Node.js `http`/`https` with a custom `lookup` function or agent-level `createConnection` override. Whether Hostinger's shared Node runtime permits raw socket control at this level is **unverified** — see verification tasks. If the runtime restricts it, the fallback is to perform DNS resolution and IP validation in application code before fetch, accepting a small TOCTOU window and documenting it as a limitation.

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
- **Automated tests (unit, runnable without DB):** malformed CSV rows, UTF-8 BOM stripping, quoted fields with embedded commas/newlines, duplicate rows within file, self-redirect rejection, loop detection (2-node and 3-node cycles), chain depth exceeding 5 hops, URL normalization (trailing slashes, query strings, percent-encoding, case sensitivity preserved distinctly), protected-path rejection, invalid status codes
- **Automated tests (integration, require test DB):** owner auth (401 anonymous), CSRF rejection (403 wrong origin), duplicate database entries rejected (409, no overwrite), concurrent duplicate creation (exactly one succeeds), audit revert validation (invalid revert fails atomically, rules unchanged), bulk disable creates accurate audit record and reverses safely, preview endpoint returns HTTP 200 JSON (never 3xx, no `Location` header)
- **Guarantee test:** public routes never evaluate redirect rules — assert no middleware or route handler reads the `redirects` table outside dashboard APIs (static import-graph check + runtime assertion that public page responses contain no redirect behavior)

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

> **Note:** The authoritative decision register is now **Section 8** below. This section is retained for continuity; where they overlap, Section 8 governs.

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

## 8. Decision Register

### A. Confirmed Constraints (do not revisit without owner approval)
- `CONTENT_SOURCE=files` preserved. No DB-to-public publishing pipeline in Phase 2.
- SEO workspace is planning/editing/preview only.
- Redirect manager is planning-only in Phase 2; production activation disabled.
- No client-side tracking; server-side GA4 Data API and Search Console API only.
- Read-only OAuth scopes: `analytics.readonly`, `webmasters.readonly`.
- Owner-only lead access and CSV export; IP and user-agent excluded by default.
- Google Cloud project, OAuth credentials, and consent flow are owner-controlled. The assistant does not create credentials or initiate OAuth on the owner's behalf.
- No secrets in git, logs, or browser code.
- All six Phase 1 documented limitations preserved.

### B. Provisional Technical Proposals (require owner approval before implementation)
- 24-month lead retention → deletion (provisional pending legal review).
- 90-day analytics API cache with `fetched_at` timestamps and stale-data indicators.
- Deletion tombstones: `SHA-256(lead_id + DELETION_SALT)`, append-only ledger file with hash chain, 25-month tombstone retention.
- Dual-salt rotation strategy for `DELETION_SALT`.
- Database-backed sliding-window rate limiting: 120 req/min authenticated per session, 10 req/min unauthenticated per IP, IP-level session-spam cap (not block), max 1-hour application-level IP blocks with owner unblock path.
- Seven-layer SSRF validation with DNS pinning and fail-closed behavior.
- k≥5 disclosure safeguard for deletion aggregates (not an anonymity claim).
- CSV format for redirect import/export (schema defined in Data Model).
- AES-256-GCM token encryption via `OAUTH_ENCRYPTION_KEY` env var.
- Health audit on-demand only; no scheduled jobs in Phase 2.

### C. Decisions Requiring Owner Approval
1. ☐ Approve tombstone ledger approach (Approach C) and `DELETION_SALT` management plan.
2. ☐ Approve rate-limit values (120/10) as starting points for implementation tuning.
3. ☐ Approve redirect manager planning-only scope for Phase 2.
4. ☐ Confirm `www.faisalhossen.com` allowlist membership (affects SSRF design).
5. ☐ Approve Phase 2 implementation as a whole (separate explicit approval).

### D. Legal Questions (qualified counsel required; no compliance claimed)
1. Lawful basis for lead processing (legitimate interest vs consent).
2. GDPR/UK GDPR applicability to site visitors.
3. Whether 24-month retention satisfies storage limitation.
4. Whether tombstone hashes (pseudonymous) require the same protections as personal data.
5. Whether k≥5 aggregates satisfy erasure/anonymization obligations.
6. Backup-retention disclosure obligations in the privacy policy.
7. DPA requirements for Google API usage.
8. Data controller confirmation and registration obligations.

### E. Environment-Dependent Items (require verification — see tasks below)
1. Whether Hostinger's Node runtime permits custom DNS `lookup` / `createConnection` overrides for SSRF pinning.
2. Hostinger's automated database backup retention period and whether table-level backup exclusion is possible.
3. Whether the runtime is single-instance (affects rate-limiting design choice).
4. Phase 1 `rate_limits` table schema compatibility with the proposed design.

---

## 9. Verification Tasks (require repository/runtime inspection or Hostinger support)

These cannot be resolved by planning alone:

| # | Task | Method |
|---|------|--------|
| 1 | Confirm Node.js version and whether `dns.lookup` override / custom `http.Agent.createConnection` works in the Hostinger runtime | Runtime inspection (test script on staging or post-deploy probe) |
| 2 | Confirm single-instance vs multi-worker Node deployment | Runtime inspection (`process.pid` logging or Hostinger docs) |
| 3 | Read Phase 1 `rate_limits` table schema | Repository inspection (`migrations/` or schema dump) |
| 4 | Hostinger automated DB backup retention period | Hostinger support / hPanel docs |
| 5 | Whether a table can be excluded from automated backups | Hostinger support |
| 6 | Whether the app has filesystem write access outside the release directory (for the deletion ledger file) | Runtime inspection |
| 7 | Confirm `www.faisalhossen.com` DNS and usage | DNS lookup + owner confirmation |
| 8 | Confirm no other subdomains serve the portfolio (affects SSRF allowlist completeness) | DNS enumeration + owner confirmation |

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

# Deployment Note — Lead Inbox Improvements (Phase 2)

## What this ZIP contains
- `lib/server/leads.ts` (new): testable leads query building (search/filter/pagination).
- `app/api/faisals-room/leads/route.ts` (modified): GET supports `?q=`, `?status=`,
  `?page=`, `?limit=`; PATCH unchanged.
- `app/faisals-room/leads/page.tsx` (modified): real inbox page (was placeholder).
- `app/faisals-room/leads/LeadsInbox.tsx` (new): inbox UI — search, status filter,
  paginated table, lead detail, status transitions, delivery status.
- `app/faisals-room/room.css` (modified): badge/table/input styles.
- `tests/leads.test.ts` (new): 13 tests.

Branch: `feat/lead-inbox-improvements` — commit `73094f2`

## Required steps
**None.** No new environment variables, no database migration, no Google Cloud
changes. The `contact_submissions` table already has everything needed.

## Deploy steps (Hostinger ZIP upload)
1. hPanel → website → **Deploy Web App → Upload ZIP** → select this ZIP.
2. Build settings unchanged: Node `22.x`, `pnpm@11.0.0`, `pnpm run build`.
3. Wait for build + restart.

## Verification after deploy
1. Sign in → **Leads** → inbox loads with existing submissions.
2. Type in search → results filter by name/email/subject/message.
3. Change status filter → list filters correctly.
4. Click a lead row → detail view opens with full message.
5. Click a status button (e.g. "Reviewing") → status updates, badge changes.
6. Pagination appears when more than 20 leads exist.
7. Public contact form still works (submit a test message → appears as "New").

## Rollback
- **Code rollback:** redeploy the previous ZIP. The inbox reverts to the
  placeholder page; the API reverts to the unfiltered list.
- **Data:** no data changes in this release — all existing leads preserved.
  Status values are unchanged (five-state workflow intact).

## Status workflow note
The inbox uses the existing five-state workflow (`new → reviewing →
qualified → won / archived`) enforced by the database CHECK constraint and
the approved Phase 2 roadmap. No migration was needed and no existing lead
records were modified.

## Remaining limitations
1. No bulk actions (e.g. archive multiple leads at once).
2. No notes thread per lead (roadmap item, not implemented).
3. No CSV export of leads (roadmap item, not implemented).
4. No automatic 24-month retention deletion (roadmap item, provisional pending
   legal review — not implemented).
5. Email delivery status is shown as recorded at submission time; no retry
   mechanism for failed notifications.

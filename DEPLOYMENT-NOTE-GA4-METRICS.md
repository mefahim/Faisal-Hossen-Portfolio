# Deployment Note — GA4 Metrics Display (Phase B+)

## What this ZIP contains
- `lib/server/analytics/ga4-reports.ts` (new): GA4 Data API v1beta `runReport` client.
- `app/api/faisals-room/analytics/reports/route.ts` (new): owner-only metrics API.
- `app/faisals-room/analytics/AnalyticsDashboard.tsx` (modified): metrics UI.
- `tests/analytics-reports.test.ts` (new): regression tests.

Branch: `feat/ga4-metrics-display` — commit `d1e7c64`

## Required Google Cloud step (one-time, do this first)
1. Open the Google Cloud project used for the GA4 OAuth client.
2. Go to **APIs & Services → Library**.
3. Search for **"Google Analytics Data API"** and **Enable** it.
   - The OAuth scope (`analytics.readonly`) is already approved; this just
     enables the Data API surface for `runReport` calls.
   - Without this, metrics requests return 403 and the dashboard shows
     "Google authorization failed. Reconnect your account."

## Required hPanel step
No new environment variables. Existing `OAUTH_ENCRYPTION_KEY`,
Google client ID/secret, and `DATABASE_URL` are reused as-is.

## Deploy steps (Hostinger ZIP upload)
1. hPanel → website → **Deploy Web App → Upload ZIP** → select this ZIP.
2. Build settings unchanged: Node `22.x`, `pnpm@11.0.0`, `pnpm run build`.
3. Wait for the build to finish and the site to restart.

## No migration required
The `analytics_cache` table already exists (migration `0003`). No new
tables or schema changes in this release.

## Verification after deploy
1. Sign in to `/faisals-room` → **Analytics**.
2. Confirm "Connected." and the saved property still show.
3. The **Traffic overview** section appears below the property picker:
   - Sessions / Total users / Page views cards for "Last 30 days".
   - Top pages table.
   - "Fetched … (live)" timestamp.
4. Change the range to "Last 7 days" → numbers update, timestamp changes.
5. Click **Refresh** → forces a live fetch (bypasses cache).
6. Reload the page → "Fetched … (cached)" appears (cache hit working).

## Rollback
- **Code rollback:** redeploy the previous ZIP (the tracking release).
  Metrics section disappears; OAuth connection, property selection, and
  client-side gtag.js tracking are unaffected.
- **Cache cleanup (optional):** cached reports live in `analytics_cache`
  with `report_type='overview'`. They expire naturally (stale badge after
  24h, purged after 90 days). To clear manually:
  `DELETE FROM analytics_cache WHERE report_type='overview';`
- No data loss: the rollback only removes the display layer. OAuth tokens
  and the saved property ID are untouched.

## Known behaviors (not bugs)
- First load after deploy takes a few seconds (live Google API call).
- Data older than 24h shows a "may be stale" badge — click Refresh.
- Empty periods show "No page data for this period." — never fake zeros.
- If Google revokes access, the UI shows "Google authorization failed.
  Reconnect your account." — disconnect and reconnect to fix.

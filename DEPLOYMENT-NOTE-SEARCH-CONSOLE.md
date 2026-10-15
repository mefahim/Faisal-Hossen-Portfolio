# Deployment Note — Google Search Console Integration (Phase 2)

## What this ZIP contains
- `lib/server/analytics/google-oauth.ts` (modified): OAuth scope is now per-provider
  (`ga4` → `analytics.readonly`, `search_console` → `webmasters.readonly`).
- `lib/server/analytics/oauth-state.ts` (modified): added `peekOAuthStateProvider()`.
- `app/api/faisals-room/analytics/oauth/callback/route.ts` (modified): shared callback
  discovers the provider from the state token; GA4 flow behavior unchanged.
- `lib/server/analytics/tokens.ts` (modified): `normalizeSiteUrl()` + provider-aware
  `setPropertyId()` (GA4 path untouched).
- `lib/server/analytics/gsc-client.ts` (new): webmasters/v3 API client.
- `lib/server/analytics/gsc-reports.ts` (new): report + cache orchestration.
- `app/api/faisals-room/search-console/*` (new): oauth/start, properties, property,
  disconnect, reports routes.
- `app/faisals-room/seo/search-console/*` (new): dashboard page + client.
- `app/faisals-room/seo/page.tsx` (modified): link card to Search Console.
- `tests/search-console.test.ts` (new): 12 tests.

Branch: `feat/google-search-console` — commit `204c88c`

## Required Google Cloud steps (one-time, do BEFORE deploying)
1. Open the same Google Cloud project used for the GA4 OAuth client.
2. **APIs & Services → Library** → search **"Google Search Console API"** → **Enable** it.
3. **APIs & Services → OAuth consent screen** → confirm the scope
   `https://www.googleapis.com/auth/webmasters.readonly` is added.
   (In Testing mode, test users can consent to any scope without verification.)
4. **No new redirect URI needed** — the existing callback
   `https://faisalhossen.com/api/faisals-room/analytics/oauth/callback`
   serves both GA4 and Search Console (provider is carried in the state token).
5. The Search Console **property** (e.g. `https://faisalhossen.com/`) must already
   be verified in Search Console for the Google account you'll connect with.

## Required hPanel steps
No new environment variables. Reuses `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `OAUTH_ENCRYPTION_KEY`, `DATABASE_URL`.

## Deploy steps (Hostinger ZIP upload)
1. hPanel → website → **Deploy Web App → Upload ZIP** → select this ZIP.
2. Build settings unchanged: Node `22.x`, `pnpm@11.0.0`, `pnpm run build`.
3. Wait for build + restart.

## No migration required
`provider_tokens` and `analytics_cache` already support the `search_console`
provider (SUPPORTED_PROVIDERS was pre-declared). No schema changes.

## Verification after deploy
1. Sign in → **SEO foundation** → **Open Search Console**.
2. Click **Connect Search Console** → Google consent shows ONLY
   `webmasters.readonly` ("See data for your Search Console properties").
3. After redirect: "Connected. Select the Search Console site…"
4. Sites auto-load; select your site → **Save site** → "Site saved."
5. **Search performance** section appears: Clicks / Impressions / Avg. CTR /
   Avg. position cards, Top queries + Top pages tables, "Fetched … (live)".
6. GA4 dashboard at `/faisals-room/analytics` still works independently
   (separate connection, separate tokens).

## Rollback
- **Code rollback:** redeploy the previous ZIP. Search Console routes/pages
  disappear; GA4 OAuth, metrics, and gtag.js tracking are unaffected.
  (The shared callback keeps working for GA4 — provider peek returns "ga4".)
- **Data cleanup (optional):**
  `DELETE FROM provider_tokens WHERE provider='search_console';`
  `DELETE FROM analytics_cache WHERE provider='search_console';`
- No GA4 data is touched by either step.

## Remaining limitations
1. Search Console data has a **2–3 day delay** — reports end 3 days ago by design.
2. A site must be **verified in Search Console** for the connecting Google account,
   or the site list will be empty.
3. GA4 and Search Console are **independent connections** — connecting one does
   not connect the other (per the approved proposal).
4. In Google OAuth Testing mode, only registered test users can consent.
5. First report load takes a few seconds (live Google API call); subsequent
   loads are cached (stale badge after 24h).

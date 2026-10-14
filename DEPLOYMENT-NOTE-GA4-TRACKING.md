# Deployment Note — GA4 Client-Side Tracking

## What this ZIP contains
- `components/GoogleAnalytics.tsx` (new): Client-side gtag.js loader using
  `next/script` with `afterInteractive` strategy. Sends `page_view` on initial
  load and on App Router client-side navigations (no duplicates).
- `app/layout.tsx` (modified): Renders `<GoogleAnalytics>` with the
  Measurement ID from the environment. No other changes.

## Required hPanel step (before or after deploy)
1. hPanel → your website → **Node.js** → **Environment variables**
2. Add: `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-8GNXG944TE`
3. Save.

## Rebuild / restart required?
**Yes — a rebuild is required.** `NEXT_PUBLIC_*` variables are inlined at
build time. Deploying this ZIP via Hostinger's "Upload ZIP" triggers a fresh
`pnpm run build`, which will pick up the new variable. No manual restart is
needed beyond the deploy itself, but if you set the env var *after*
deploying, redeploy (or rebuild) so the value is baked in.

If the variable is unset, the site builds and runs normally — the tracking
tag is simply not loaded.

## Verification after deploy
1. Visit https://faisalhossen.com and view page source: confirm
   `googletagmanager.com/gtag/js?id=G-8GNXG944TE` is present.
2. Google Tag Assistant should detect the tag.
3. GA4 Realtime should show active users when visiting the site.
4. Existing OAuth dashboard at /faisals-room/analytics is untouched.

## What was NOT changed
- GA4 OAuth flow, token encryption, property selection, disconnect: untouched.
- Database schema: no migrations in this ZIP.
- No secrets or credentials in the bundle.

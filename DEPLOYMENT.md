# Deployment Guide — GA4 Phase B Step 2 (OAuth + Properties + Disconnect)

**Source commit:** `82d426f3` (branch `feat/ga4-phase-b-step2-pr-b-properties`)
**Includes:** PR #24 (OAuth, merged to main as `5dec63f`) + PR-B (properties) + PR-C (disconnect)

## Prerequisites

### 1. Environment variables (hPanel → Node.js → Environment variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Existing; URL-encode `#` as `%23` |
| `OAUTH_ENCRYPTION_KEY` | Yes | Existing; base64-encoded 32 bytes |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes | From Google Cloud Console |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes | From Google Cloud Console |
| `NEXT_PUBLIC_SITE_URL` | Yes | Must be `https://faisalhossen.com` (no trailing slash) |
| `NODE_ENV` | Yes | `production` |
| `APP_SECURITY_SECRET` | Yes | Existing; do not change |

**Never** put secrets in code, chat, screenshots, or the ZIP.

### 2. Google Cloud (one-time setup)

- OAuth Web Client created with redirect URI: `https://faisalhossen.com/api/faisals-room/analytics/oauth/callback`
- Analytics Data API + Analytics Admin API enabled
- Your Google account added as test user (Testing mode)
- Scope: `analytics.readonly` only

### 3. Database

Migrations `0001`–`0004` are already applied in production. **No new migrations in this release.** Verify:
```sql
SELECT name FROM schema_migrations ORDER BY name;
-- Expect: 0001_foundation.sql, 0002_redirects.sql, 0003_provider_tokens.sql, 0004_oauth_states.sql
```

Take a fresh backup before deploying (mysqldump or phpMyAdmin export).

## Deployment steps (Hostinger)

1. Download and verify the ZIP (check SHA-256 below).
2. hPanel → Websites → your site → **Deploy Web App** → Upload ZIP.
3. Build settings:
   - Framework: Next.js
   - Node.js: 22.x
   - Package manager: pnpm 11.0.0 (auto-detected from `packageManager`)
   - Build: `pnpm run build`
   - Start: `pnpm start` (or auto-detect)
4. Confirm all environment variables from the table above are set.
5. Watch the build log for:
   - `✓ Compiled successfully`
   - `✓ Generating static pages (50/50)`
   - No `ERR_PNPM_IGNORED_BUILDS` errors
6. Wait for deployment to complete and the app to restart.

## Smoke tests (after deploy)

- [ ] `https://faisalhossen.com/` → 200
- [ ] `https://faisalhossen.com/faisals-room` → 307 (redirect to login)
- [ ] Login works → dashboard loads
- [ ] `https://faisalhossen.com/faisals-room/analytics` → shows "Connect GA4" button
- [ ] Click Connect → redirects to Google consent page (do NOT complete unless testing)
- [ ] No 500 errors in hPanel → Node.js → App logs

## Testing the OAuth flow (manual, owner only)

1. On the analytics dashboard, click **Connect GA4**.
2. You'll redirect to Google — sign in and grant `analytics.readonly` access.
3. Google redirects back; dashboard shows "Connected."
4. Click **Load my GA4 properties** → select your property → **Save property**.
5. To disconnect: click **Disconnect** → confirm. Tokens are revoked and deleted.

**Note:** In Google Testing mode, tokens expire after 7 days. You'll need to reconnect weekly, or apply for OAuth verification for longer-lived access.

## Rollback

If the build fails or smoke tests fail:
1. hPanel → Node.js → previous deployment → Redeploy.
2. Or via SSH: point `~/domains/faisalhossen.com/hbuilds/current` symlink to the previous release UUID, restart the app.
3. No database rollback needed (no new migrations in this release).

## What's new in this release

- **OAuth connection:** Real Google OAuth2 with PKCE — Connect button initiates flow, callback exchanges code for encrypted tokens.
- **Property selection:** List your GA4 properties, pick one, save it.
- **Disconnect:** Revoke at Google and purge local credentials.
- **Security:** Owner-only routes, CSRF protection, rate limiting, encrypted token storage, no secrets in logs.

## Support

- Setup docs: `docs/ga4-setup.md` (in this ZIP)
- Issues: https://github.com/mefahim/Faisal-Hossen-Portfolio/issues

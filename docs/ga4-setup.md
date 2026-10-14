# GA4 Integration — Google Cloud Setup Guide

**Phase A status:** Foundation is implemented (encryption, OAuth utilities, dashboard UI).
**Phase B requires** the Google Cloud configuration below before real GA4 data can flow.

This document is for the site owner (Fahim). No credentials should ever be
committed to source code or shared in chat — set them in hPanel only.

---

## 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g., `faisalhossen-analytics`)
3. Note the Project ID

## 2. Enable the Analytics Data API

1. In the Cloud Console, go to **APIs & Services → Library**
2. Search for **"Google Analytics Data API"**
3. Click **Enable**

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. User type: **External**
3. Fill in app name, support email, developer contact
4. **Scopes:** Add `https://www.googleapis.com/auth/analytics.readonly`
5. Add your Google account as a test user (while in testing mode)

## 4. Create OAuth Credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `Faisals Room GA4`
4. **Authorized redirect URIs** — add exactly:
   ```
   https://faisalhossen.com/api/faisals-room/analytics/oauth/callback
   ```
5. Save the **Client ID** and **Client Secret**

## 5. Set Server Environment Variables (hPanel)

Set these in hPanel → Node.js app → Environment variables. **Never in code.**

| Variable | Value | How to generate |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | From step 4 | Cloud Console |
| `GOOGLE_OAUTH_CLIENT_SECRET` | From step 4 | Cloud Console |
| `OAUTH_ENCRYPTION_KEY` | Base64-encoded 32 bytes | `openssl rand -base64 32` |

Generate the encryption key locally:
```bash
openssl rand -base64 32
```

**Key requirements:**
- Must decode to exactly 32 bytes
- If missing or invalid, provider features fail closed (dashboard shows "not connected")
- If lost, existing tokens become undecryptable → disconnect and reconnect

## 6. Connect in the Dashboard

1. Deploy the Phase B code
2. Go to `https://faisalhossen.com/faisals-room/analytics`
3. Click **Connect GA4**
4. Authorize with the Google account that has access to your GA4 property
5. Select your GA4 property from the picker

## 7. Verify

- Dashboard shows real sessions, users, pageviews with a fetch timestamp
- Date ranges (7/30/90 days) return different data
- Disconnect removes all token data

---

## Security Notes

- Tokens are encrypted with AES-256-GCM before database storage
- Only the `analytics.readonly` scope is requested (no write access)
- All token handling is server-side; tokens never reach the browser
- No client-side tracking (no gtag.js) — data is fetched via API only

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Not connected" after setup | Check env vars in hPanel; restart app |
| OAuth error 400 | Redirect URI mismatch — must match exactly |
| "Token expired" | Normal after 1 hour; auto-refresh should handle it. If persistent, disconnect/reconnect |
| No data shown | GA4 property has no traffic in selected date range |

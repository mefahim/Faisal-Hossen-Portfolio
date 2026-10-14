# Production Deployment Plan — Merged `main` (d3ce805)

**Status:** PREPARED — NOT EXECUTED. Awaiting owner authorization.
**Date:** 2026-10-14
**No production deployment occurred during this verification.**

## 1. Current Production State (verified)

| Item | Value |
|------|-------|
| Active release | `hbuilds/versions/01a137c8-39ec-7247-9a61-b267873a44ae` |
| Code fingerprint | 6697361 + manual hash-wasm swap (NOT the merged main) |
| Has hash-wasm 4.12.0 | Yes (login works) |
| Has a11y fixes (skip-link) | No |
| Has server-only explicit dep | No |
| Node.js | v22.23.3 (alt-nodejs22) |
| MEDIA_STORAGE_DIR | `/home/u263467780/faisals-room-media` (outside `hbuilds/`) |
| CONTENT_SOURCE | `files` |

## 2. Target

| Item | Value |
|------|-------|
| Target commit | `d3ce805` (merged `main`) |
| Delta vs production | A11y fixes (skip-link, button labels) + docs + server-only dep + test script fix. **No logic changes to auth, DB, or public routes.** |

## 3. Environment Variables (hPanel — no changes required)

The following are already configured; the deployment must not alter them:
- `DATABASE_URL` (fixed: `#` → `%23`)
- `DATABASE_SSL`, `MEDIA_STORAGE_DIR`, `CONTENT_SOURCE=files`
- `APP_SECURITY_SECRET`, `NEXT_PUBLIC_SITE_URL`
- `BOOTSTRAP_OWNER_EMAIL`, `CONTACT_EMAIL`

**Dependency compatibility:** `hash-wasm@4.12.0`, `server-only@0.0.1` are pure-JS (no native bindings). Compatible with Node 22 on Hostinger Passenger. Verified via `next build` locally.

## 4. Pre-deployment Checks

- [ ] Confirm `d3ce805` builds cleanly (`next build` — done, verified)
- [ ] Confirm database backup exists (Hostinger hPanel → Databases → Export)
- [ ] Confirm `MEDIA_STORAGE_DIR` contents listed (currently empty after test cleanup)
- [ ] Note current active release UUID for rollback: `01a137c8-39ec-7247-9a61-b267873a44ae`

## 5. Deployment Procedure (reversible)

1. Build production bundle from `d3ce805` locally (`next build`).
2. Package as Hostinger-compatible ZIP (standalone output + `package.json` + `pnpm-lock.yaml`).
3. Upload to `~/domains/faisalhossen.com/hbuilds/versions/<new-uuid>/` via SSH.
4. Run `pnpm install --prod` (or use prebuilt `node_modules`) in the new version dir.
5. Atomically switch symlink: `ln -sfn versions/<new-uuid> ~/domains/faisalhossen.com/hbuilds/current`
6. Trigger Passenger restart: `touch ~/domains/faisalhossen.com/hbuilds/current/tmp/restart.txt`
7. Wait 30s, run post-deployment checks (below).

**Expected downtime:** ~30-60 seconds during Passenger restart. No data loss expected (DB and media are outside the release dir).

## 6. Post-deployment Health Checks

- [ ] `GET /` → 200
- [ ] `GET /faisals-room/login` → 200
- [ ] `POST /api/faisals-room/auth/login` (correct) → 200 + cookie
- [ ] `POST /api/faisals-room/auth/login` (wrong) → 401
- [ ] `GET /faisals-room` (auth) → 200; (anon) → 307
- [ ] `GET /robots.txt` → disallows `/faisals-room`
- [ ] Skip-link present in page HTML (verifies a11y deploy)

## 7. Rollback Procedure

If any health check fails:
1. Switch symlink back: `ln -sfn versions/01a137c8-39ec-7247-9a61-b267873a44ae ~/domains/faisalhossen.com/hbuilds/current`
2. Trigger Passenger restart (same `touch` command).
3. Re-run health checks.
4. Database requires no rollback (no migrations in this change).

**Rollback time:** < 2 minutes. No data loss (the change touches no DB schema).

## 8. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New version fails to start | Low (build verified) | Rollback via symlink (< 2 min) |
| Env var mismatch | Very low (no env changes) | Pre-verified; hPanel untouched |
| Brief downtime during restart | Certain (~30-60s) | Schedule during low-traffic window |
| Media loss | None (outside release dir) | Architectural guarantee |

---

# Media Release-Durability Test Procedure

**Status:** PREPARED — NOT EXECUTED. Requires deployment authorization.

## Prerequisites

- [ ] Production deployment of `d3ce805` authorized and completed (see plan above)
- [ ] Owner confirms a safe testing window
- [ ] Database backup verified

## Procedure (non-destructive)

### Phase A — Baseline (before release)
1. Upload a disposable test image via `POST /api/faisals-room/media` (authenticated, 1x1 PNG, alt text "RELEASE-TEST — safe to delete").
2. Record the returned media ID and the three storage keys (original + 2 derivatives).
3. Verify files exist in `/home/u263467780/faisals-room-media/`.
4. Verify DB row exists in `media` table with `processing_state='ready'`.
5. Record checksums of the three files.

### Phase B — Release change
6. Execute the production deployment per the plan above (new release UUID).
7. Trigger Passenger restart; wait for health checks to pass.

### Phase C — Verification (after release)
8. Confirm the three files still exist at identical paths with identical checksums.
9. `GET /api/faisals-room/media/<id>` (authenticated) → 200 with correct metadata.
10. Confirm DB `media` row still references the same `storage_key`.
11. Verify private access control: anonymous `GET` → 401.
12. Delete the test media via API; confirm files cleaned up.

## Pass Criteria
- All three files byte-identical before/after release.
- DB references unchanged.
- Authenticated access works; anonymous denied.
- No existing production media touched.

## Why This Is Safe
- Test uses a disposable 1x1 image, not client content.
- Media dir is outside `hbuilds/`; the release mechanism cannot delete it.
- The test only ADDS then REMOVES its own files.
- Rollback available at every step via symlink.

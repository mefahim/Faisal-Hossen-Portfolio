# Faisal Hossen — Digital Problem Solver

A Next.js App Router portfolio for Faisal Hossen’s independent digital problem-solving practice. **Faisal’s Room** is the single-owner private control center added under `/faisals-room`; the public website remains at its existing root routes.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. The public site continues to use its verified file-backed content by default. Copy `.env.example` to a local environment file only when configuring the private product; never commit real credentials.

## Public routes

- `/` — Home and Selected Work entry point
- `/work` — Selected Work index
- `/work/peoria-hardwood-floors` — Peoria Hardwood Floors case study
- `/work/nicola` — Nicola case study
- `/work/ai-flooring-visualizer` — AI Flooring Visualizer case study
- `/about` — About the practice and working principles
- `/contact` — Contact form with durable lead storage once PostgreSQL is configured

## Private Phase 1 routes

`/faisals-room` is owner-only. Its workspaces are `/login`, `/pages`, `/projects`, `/media`, `/seo`, `/leads`, `/analytics`, `/navigation`, `/settings`, and `/system`, plus an authenticated draft preview. **Do not create or use `/admin`.** Analytics and expanded SEO/inbox behavior remain Phase 2 connection/empty states; there are no fake measurements.

## Phase 1 database setup

Provision PostgreSQL and persistent server-side media storage, then configure `DATABASE_URL`, `APP_SECURITY_SECRET` (random, at least 32 characters), `MEDIA_STORAGE_DIR` (outside `public/`, durable across releases), and the verified `NEXT_PUBLIC_SITE_URL`. Keep `CONTENT_SOURCE=files` initially.

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify-seed
```

After reviewing parity output, set `BOOTSTRAP_OWNER_EMAIL` and a strong `BOOTSTRAP_OWNER_PASSWORD` of at least 14 characters in the server environment and run:

```bash
pnpm db:bootstrap-owner
```

Remove `BOOTSTRAP_OWNER_PASSWORD` (and the temporary bootstrap email) immediately after success. Sign in, review the seeded draft records, and explicitly publish content only after checking it. Keep `CONTENT_SOURCE=files` until the review/rollback decision is made; the database-backed public adapter checks completeness and falls back to the verified file source.

Optional Resend credentials (`RESEND_API_KEY`, `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL`) enable notification after a contact record is committed. Durable lead storage is the primary operation. If email is not configured or delivery fails, the sender sees an honest stored/delivery state.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
```

Database migration, seed parity, authenticated workflow, and media-persistence acceptance require the configured PostgreSQL and persistent storage described in [RELEASE.md](./RELEASE.md) and the Phase 1 report.

## Evidence-led project content

The three project stories are structured in `content/projects.ts` from committed source documents under `content/project1-doc.json`, `content/project2-doc.json`, and `content/project3-doc.json`. Supplied visuals are under `public/assets/projects/` and are reused without replacement or invented annotations. Only verified live URLs are shown; no metrics, testimonials, awards, certifications, client outcomes, or email addresses are invented.

## Continuation and reports

- [Master plan](./plan.md) — approved three-phase architecture and exact scope
- [Phase TODO](./FAISALS-ROOM-TODO.md) — implementation checklist and gates; Phase 2/3 remain open
- [Phase 1 implementation report](./FAISALS-ROOM-PHASE-1-REPORT.md) — changes, security, validation, configuration, and next steps
- [Release/runbook](./RELEASE.md) — PostgreSQL setup, owner bootstrap, media persistence, deployment, and smoke tests
- [`plan-archive-2026-10-08.md`](./plan-archive-2026-10-08.md) — historical Phase 1 planning notes
- [`PHASE-1-REPORT.md`](./PHASE-1-REPORT.md) — historical portfolio delivery record
- [`PHASE-2-REPORT.md`](./PHASE-2-REPORT.md), [`PHASE-2-HANDOFF.md`](./PHASE-2-HANDOFF.md) — earlier public-website delivery records (not Faisal’s Room Phase 2)
- [`FINAL-REFINEMENT-REPORT.md`](./FINAL-REFINEMENT-REPORT.md) — public website content and QA notes
- [`content-asset-map.md`](./content-asset-map.md) — source-to-local asset mapping

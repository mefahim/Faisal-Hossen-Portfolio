# Faisal Hossen — Digital Problem Solver

A Next.js App Router portfolio for Faisal Hossen’s independent digital problem-solving practice.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_SITE_URL` to the real public production origin before production so canonical, sitemap, and social URLs are absolute. For real form delivery, configure `RESEND_API_KEY`, `CONTACT_EMAIL`, and a verified `CONTACT_FROM_EMAIL` on the hosting provider. Secrets are read only by `/api/contact` and are never bundled into the browser.

## Routes

- `/` — Home and Selected Work entry point
- `/work` — Selected Work index
- `/work/peoria-hardwood-floors` — Peoria Hardwood Floors case study
- `/work/nicola` — Nicola case study
- `/work/ai-flooring-visualizer` — AI Flooring Visualizer case study
- `/about` — About the practice and working principles
- `/contact` — Functional contact form with server validation, verified phone/social links, and environment-based email delivery

## Evidence-led project content

The three project stories are structured in `content/projects.ts` from the committed source documents under `content/project1-doc.json`, `content/project2-doc.json`, and `content/project3-doc.json`. Supplied visuals are under `public/assets/projects/` and are reused without replacement or invented annotations.

Only these verified live URLs are shown:

- <https://peoriahardwoodfloors.com>
- <https://faisalhossen.com/nicolav1/>

No public live URL was supplied for AI Flooring Visualizer, so the site does not invent one. No metrics, testimonials, awards, certifications, dates, client outcomes, or email addresses are claimed. The supplied phone and exact social URLs are documented in the final refinement report.

## Reports and continuation notes

- [`plan.md`](./plan.md) — Faisal's Room repository audit and exactly 3-phase implementation plan; planning only until user approval
- [`FAISALS-ROOM-TODO.md`](./FAISALS-ROOM-TODO.md) — phase-gated execution TODO for the next agent
- [`plan-archive-2026-10-08.md`](./plan-archive-2026-10-08.md) — historical Phase 1 implementation plan retained for context
- [`PHASE-1-REPORT.md`](./PHASE-1-REPORT.md) — foundation and Home delivery record
- [`PHASE-2-REPORT.md`](./PHASE-2-REPORT.md) — real projects, Work, About, Contact, and remaining limitations
- [`PHASE-2-HANDOFF.md`](./PHASE-2-HANDOFF.md) — continuation brief and source evidence
- [`content-asset-map.md`](./content-asset-map.md) — source-to-local asset mapping
- [`FINAL-REFINEMENT-REPORT.md`](./FINAL-REFINEMENT-REPORT.md) — Work card, contact, form, QA, and screenshot report
- [`RELEASE.md`](./RELEASE.md) — hosting deployment handoff and environment configuration

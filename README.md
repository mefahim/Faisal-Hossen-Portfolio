# Fahim — Digital Problem Solver

A Next.js App Router portfolio for Fahim’s independent digital problem-solving practice.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_SITE_URL` to the real public production origin before production so canonical, sitemap, and social URLs are absolute. The current repository intentionally leaves this unset until a verified production origin is supplied.

## Routes

- `/` — Home and Selected Work entry point
- `/work` — Selected Work index
- `/work/peoria-hardwood-floors` — Peoria Hardwood Floors case study
- `/work/nicola` — Nicola case study
- `/work/ai-flooring-visualizer` — AI Flooring Visualizer case study
- `/about` — About the practice and working principles
- `/contact` — Transparent contact page; no unverified email, social link, or fake form is included

## Evidence-led project content

The three project stories are structured in `content/projects.ts` from the committed source documents under `content/project1-doc.json`, `content/project2-doc.json`, and `content/project3-doc.json`. Supplied visuals are under `public/assets/projects/` and are reused without replacement or invented annotations.

Only these verified live URLs are shown:

- <https://peoriahardwoodfloors.com>
- <https://faisalhossen.com/nicolav1/>

No public live URL was supplied for AI Flooring Visualizer, so the site does not invent one. No metrics, testimonials, awards, certifications, dates, client outcomes, email addresses, or social links are claimed.

## Reports and continuation notes

- [`PHASE-1-REPORT.md`](./PHASE-1-REPORT.md) — foundation and Home delivery record
- [`PHASE-2-REPORT.md`](./PHASE-2-REPORT.md) — real projects, Work, About, Contact, and remaining limitations
- [`PHASE-2-HANDOFF.md`](./PHASE-2-HANDOFF.md) — continuation brief and source evidence
- [`content-asset-map.md`](./content-asset-map.md) — source-to-local asset mapping

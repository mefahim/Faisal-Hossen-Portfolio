# Faisal Hossen Portfolio — Hosting Release

**Release:** Final UI Refinement  
**Application:** Next.js App Router portfolio  
**Runtime:** Node.js 22+ with pnpm  
**Server requirement:** Enabled because `/api/contact` is a server route  
**Database:** Not required

## Deploy

Use the repository root as the hosting project directory. Install dependencies, build the application, and run the Next.js server:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The process must listen on the hosting provider’s `PORT` value. The existing `next start` script uses the standard Next.js runtime and serves the static pages plus `/api/contact`.

## Required environment configuration

Set these variables in the hosting provider’s secret/environment settings, never in committed source:

```text
RESEND_API_KEY=...
CONTACT_EMAIL=...
CONTACT_FROM_EMAIL=...
```

`CONTACT_FROM_EMAIL` must be a sender address verified with the selected Resend account/domain. The form deliberately returns an honest setup error until all three values are present; it never pretends to deliver a message.

Set the public origin when a production URL is available:

```text
NEXT_PUBLIC_SITE_URL=https://your-verified-production-origin.example
```

This enables absolute canonical, sitemap, Open Graph, and Twitter URLs. Do not replace the supplied social links with guessed provider URLs.

## Verified contact values

- Phone: `+8801815676523`
- Phone href: `tel:+8801815676523`
- Facebook: <https://faisalhossen.com/facebook>
- Instagram: <https://faisalhossen.com/instagram>
- GitHub: <https://faisalhossen.com/github>
- LinkedIn: <https://faisalhossen.com/linkedin>

## Public routes

- `/`
- `/work`
- `/work/peoria-hardwood-floors`
- `/work/nicola`
- `/work/ai-flooring-visualizer`
- `/about`
- `/contact`

The API route `/api/contact` is intentionally excluded from `public/manus-routes.json` because the manifest lists page routes only. `robots.txt` disallows `/api/`.

## Release verification

Before switching traffic, run:

```bash
pnpm exec tsc --noEmit
rm -rf .next && pnpm build
```

Then check the page routes above, submit an empty form to confirm field validation, and submit a valid form after the three Resend variables are configured. Confirm the phone link and all four exact social URLs. The final visual review set is listed in `FINAL-REFINEMENT-REPORT.md`.

## Artifact

The GitHub release asset is `faisal-hossen-portfolio-hosting-release.zip`. It contains the deployable source, lockfile, public assets, contact API, documentation, and no secrets, `node_modules`, or `.next` build cache.

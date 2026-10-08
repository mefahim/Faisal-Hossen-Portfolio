# Faisal Hossen — Personal Digital HQ: Phase 1 Plan

## Source of truth

- **Master specification:** Notion page “Faisal Hossen — Personal Website Master Specification v2”, read on 2026-10-08.
- **Request brief:** `/home/ubuntu/upload/pasted_content.txt`.
- **Approved blueprint:** Phase 1 only: foundation, design system, global shell, accessible interaction foundation, SEO foundation, and Home page. `/work`, `/work/[slug]`, `/about`, and Phase 3 production launch work remain gated.

## Phase boundary

This phase delivers a credible first surface of the product, not a complete portfolio. It will establish the visual language and prove Faisal Hossen’s positioning without inventing clients, outcomes, metrics, testimonials, awards, or project evidence. It includes:

1. Next.js App Router foundation with TypeScript and Tailwind CSS.
2. Editorial/product design system, typography, color tokens, spacing, radii, focus states, and reduced-motion behavior.
3. Responsive global shell: wordmark, desktop navigation, mobile navigation, footer, CTA primitives, tags, section heading, and page transition/reveal primitives.
4. Home page narrative: problem → thinking → proof → capability → trust → action.
5. A non-fabricated Workbench/Problem Playground that demonstrates how Faisal Hossen frames digital problems, using only supplied identity imagery and clearly labelled thinking states.
6. Initial SEO metadata, canonical placeholder policy, Open Graph/Twitter structure, sitemap, robots, structured data, and `public/manus-routes.json`.
7. Responsive/accessibility foundation for 360–1600px layouts.
8. A Phase 1 report and approval gate before any Phase 2 implementation.

## Product and information architecture

### Confirmed primary routes

- `/` — Home: positioning, visual proof/workbench, capabilities, approach, trust, and CTA.
- `/work` — reserved for Phase 2 Work / Case Studies.
- `/work/[slug]` — reserved for Phase 2 structured case-study details when verified project content exists.
- `/about` — reserved for Phase 2 About + Contact.

Phase 1 only implements `/`. The global shell uses clearly marked next-phase navigation affordances rather than shipping broken links or fabricated page content.

### Home narrative

1. **Quiet top bar:** Faisal Hossen wordmark, concise navigation, restrained project CTA.
2. **Hero:** “I don't just build websites. I solve digital problems.” plus the supplied supporting statement and two CTAs.
3. **Workbench:** visual proof of a problem-solving mindset, not a claim of client results. A real supplied portrait anchors the human side; small system labels show “Frame the problem”, “Make the next step clear”, and “Build for the people using it”.
4. **Proof without theatre:** honest statement that the site is being built as a product demonstration, with no invented metrics or testimonials.
5. **Capabilities:** Web, Digital Products, AI, Automation, UX, SEO as reusable compact capability rows.
6. **Problem Playground:** selectable problem chips with contextual diagnosis, recommendation, and next step. No score, no gamification, no unsupported claim.
7. **How I think:** three principles: clarify before adding, design for the real workflow, and ship a calm, reliable next step.
8. **Trust / expectation strip:** clear scope language, worldwide availability as specified, and an explicit no-hype promise.
9. **Final CTA:** “Have a problem worth solving?” with “No pressure. No complicated pitch. Just a conversation about the problem.” Contact destination stays a clearly marked placeholder until a verified email or link is supplied.
10. **Footer:** navigation state, capability labels, and Phase 2/3 content boundary handled without exposing unfinished claims.

## Design direction

### Design movement

**Editorial product design**: the restraint of contemporary editorial layouts combined with the clarity and statefulness of a thoughtful product interface. The site should feel like a calm digital workspace rather than a template portfolio.

### Core principles

1. **Clarity with a point of view:** large typographic decisions and short copy carry the narrative.
2. **Proof over polish:** show a real person and real thinking states; never simulate client success.
3. **Responsive by intention:** mobile gets its own composition, touch rhythm, and horizontal modules.
4. **Calm interaction:** every motion explains, reveals, or orients; nothing moves for decoration.

### Color philosophy

- **Warm ivory background `#F5F3EE`:** human, considered, and less sterile than pure white.
- **Surface `#FBFAF7` and surface-2 `#EEECE6`:** create editorial rhythm without heavy card stacking.
- **Ink `#11130F`:** high-contrast, confident, and readable.
- **Muted `#6F716B`:** secondary information that stays quiet.
- **Line `rgba(17,19,15,.11)`:** structure without visual noise.
- **Signature chartreuse `#B6FF45`:** a small, ownable signal for active states and conversion moments; use sparingly so it feels intentional rather than neon.
- Optional dark sections are used only as grounding moments; the site is not globally dark.

### Layout paradigm

Use an **asymmetric editorial rail**: a wide narrative column paired with a narrow metadata rail, interrupted by full-bleed or horizontally scrolling proof modules. Avoid uniform centered card grids. On mobile, the rail collapses into full-width thumb-friendly modules with horizontal overflow where it improves inspection.

### Signature elements

1. **Diagnostic rail:** small numbered labels and connector lines that make the thinking process visible.
2. **Workbench frame:** a tactile, product-like shell containing portrait, status labels, and problem states.
3. **Chartreuse signal:** one active marker, underline, or CTA detail per interaction cluster; never use glow or decorative gradients.

### Interaction philosophy

- Buttons shift 1–2px, update background/ink contrast, and move the arrow slightly.
- Problem chips change the diagnosis panel in place and preserve keyboard focus.
- Workbench labels reveal context through opacity/translate changes, not through elaborate animation.
- Cards expose metadata on hover/focus, but all important content remains available without hover.
- Navigation is lightweight and never blocks the page with a theatrical menu.
- All meaningful transitions are 180–450ms and disabled or minimized under `prefers-reduced-motion`.

### Animation guidelines

- Use opacity + short translate for section reveals.
- Use a subtle image scale on focus/hover only where it communicates inspection.
- Do not hijack scroll, autoplay video, play sound, add particles, use cursor tricks, or add decorative WebGL.
- Touch feedback must be immediate and legible; preserve layout stability.

### Typography system

Use `Inter` for interface clarity and `DM Sans` for display/supporting warmth, loaded through `next/font/google` with `display: swap`. Headlines use a tight, confident scale with short line lengths; body copy uses generous leading and a readable measure; metadata is uppercase/mono-like only when it improves orientation.

### Brand essence

- **Positioning:** A problem-solving digital partner for businesses that need clearer workflows, better experiences, and dependable web products.
- **Personality:** thoughtful, practical, quietly confident.
- **Brand voice:** plainspoken, observant, and specific; never inflated or salesy.
- **Example lines:**
  - “Start with the problem, not the platform.”
  - “A better digital experience usually begins with one clearer next step.”

### Wordmark and logo concept

Use a typographic **FAISAL HOSSEN ·** wordmark with a small chartreuse diagnostic dot. The dot represents a point of attention or the next useful question; it is not a decorative icon. A future logo asset can replace the CSS wordmark in Phase 2 without changing the shell.

### Signature brand color

**Diagnostic chartreuse `#B6FF45`** — reserved for active states, selected problem chips, a CTA accent, and the tiny wordmark marker.

## Technical architecture

- **Framework:** Next.js App Router, React, TypeScript.
- **Styling:** Tailwind CSS with CSS variables for the design tokens and a small global stylesheet for typography, focus, reduced-motion, selection, and scroll behavior.
- **Interaction:** small client components only where state is required (`MobileNav`, `ProblemPlayground`, `Reveal`). Server components remain the default.
- **Icons:** Lucide React, limited to meaningful navigation and directional affordances.
- **Content/data:** `/content/site.ts` for voice, capabilities, problem states, and route metadata; future project data belongs in `/content/projects.ts` without mixing content into layout components.
- **Reusable UI:** `/components/site` for Header, MobileNav, Footer, Button, SectionHeading, Chip, Reveal, Workbench, ProblemPlayground, CapabilityList, and CTA.
- **Public assets:** the supplied Phase 1 portrait is kept as a small project-local `public/assets/faisal-workbench.jpg` so the direct Preview dev port renders it reliably; the managed `/manus-storage/...` upload remains available as a durable project-storage backup. Additional supplied portraits are used unchanged on About and Contact, following the same evidence-first mapping.
- **SEO:** `app/layout.tsx` metadata base and social defaults; route-specific metadata in route files; `app/sitemap.ts`, `app/robots.ts`, JSON-LD for Person/WebSite/ProfessionalService where claims are supported; `public/manus-routes.json` synchronized with implemented routes.
- **Serving:** local development listens on the managed runtime port `3000` at `0.0.0.0`; Preview is the authoritative visual surface.
- **Future contact:** Phase 1 uses a non-submitting CTA placeholder until a verified public email/contact URL is provided. No server/database is enabled in this phase.

## Asset and content mapping

| Source asset | Observed content | Phase 1 use | Trust/handling note |
| --- | --- | --- | --- |
| `drive_asset_01.jpg` | Full-body outdoor portrait, navy shirt, warm bokeh | Home Workbench portrait / human proof | Real supplied identity reference; preserve face, skin tone, proportions, hairstyle. |
| `drive_asset_02.png` | Full-body beach portrait at sunset, phone in hand | Reserved for Phase 2 About visual story | Do not reuse as generic background. |
| `drive_asset_03.png` | Front-facing smiling portrait at the beach, black shirt | Reserved for Phase 2 About / contact visual | Real supplied identity reference; meaningful alt text only. |
| `drive_asset_04.png` | Back-facing beach/sunset portrait | Reserved for Phase 2 reflective visual story | Never present as client/project proof. |
| `drive_asset_05.png` | Close portrait on light background, black jacket | Reserved for Phase 2 About profile block | Best candidate for future avatar/profile image. |

**Missing or unverified:** project screenshots, project names, project descriptions, verified outcomes, testimonials, client logos, work links, email address, social URLs, availability details, resume/CV, brand logo file, and any verified metrics. The implementation will not fabricate these. Phase 2 must either receive them or label projects as concept/personal experiment with “design goal” language.

## Acceptance interpretation

A successful Phase 1 is a coherent, responsive, accessible Home experience with the above content boundaries, no unsupported claims, no broken primary navigation, meaningful interactions, initial SEO files, route manifest, and a clean build. The Phase 1 completion report will explicitly list what is delivered, what remains missing, and the approval gate before Phase 2.

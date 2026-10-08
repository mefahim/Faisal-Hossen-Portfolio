# Phase 2 + Future Work Handoff

এই document-টি এমনভাবে লেখা হয়েছে যেন অন্য একজন AI coding agent শুধু এই GitHub repository clone করে কাজ শুরু করতে পারে। বর্তমান repository-তে **Phase 1 সম্পন্ন**, কিন্তু Phase 2 implementation এখনো শুরু হয়নি। Phase 2-এর জন্য supplied real project assets এবং Google Docs-এর extracted source data repository-তে রাখা হয়েছে।

## Repository and current state

- GitHub repository: https://github.com/mefahim/Faisal-Hossen-Portfolio
- Main branch: `main`
- Current baseline before this handoff: Phase 1 commit `63b12ee2e988ea72f79e785514aa47e25d9d76e7`
- Project name: `fahimsite`
- Framework: Next.js App Router, React, TypeScript, Tailwind CSS
- Package manager: pnpm 11
- **Important:** the original Sandbox directory, local filesystem paths, Preview URL, runtime port, environment ID, and Manus workspace are not portable. They may all be different in the next agent’s device/environment. Do not reference or depend on `/home/ubuntu/fahimsite` or any previous Preview origin.
- After cloning, use the actual checkout directory reported by the current environment. Discover the current runtime/Preview URL through that environment’s own web tooling, if available.
- Existing platform logo metadata is in `app.config.ts`; do not remove it.
- Push normal commits to the checked-out repository’s `main` branch using the currently configured GitHub authentication. Never force-push, delete branches, or assume that an old remote name exists.

## Required access and skills for the next Manus AI agent

The user will provide access to only the GitHub repository and, if needed, the Google Drive folder. That is sufficient because the current handoff commit already contains the extracted source documents and project images. The next agent must not require access to the original Sandbox, original project directory, or old Preview URL.

Before implementation, the next Manus agent should read these skills in its own environment:

1. **`webdev`** — mandatory for continuing the Next.js website, using the environment’s project tooling, diagnostics, preview, checkpoints, and Git workflow.
2. **`webdev-seo`** — mandatory for the new `/work`, `/work/[slug]`, `/about`, and `/contact` routes, route metadata, canonical behavior, sitemap, robots, and crawler-visible HTML.
3. **`image-processing`** — recommended when inspecting, resizing, compressing, or validating the supplied PNG assets. Do not generate replacement images or alter Fahim’s identity.
4. **`gws-best-practices`** — read only if the next agent needs to re-open or verify the Google Drive source folder using the Google Workspace CLI. The checked-in JSON documents and PNG assets are already sufficient for implementation.
5. **`office-documents`** — optional only if the next agent needs to inspect or convert Google-exported document files beyond the checked-in JSON. It is not required for the normal Phase 2 implementation.

No new custom skill needs to be created for this task. The existing Manus skills above cover the work. If the new environment uses a local-development workflow, the agent should also follow that environment’s `webdev-worklocally` rules before initializing or attaching a local project; it must not assume the previous environment’s managed project state is available.

## Exact instruction to the next AI agent

> Clone `https://github.com/mefahim/Faisal-Hossen-Portfolio` and continue the existing Next.js project. Read `PHASE-2-HANDOFF.md`, `PHASE-1-REPORT.md`, `plan.md`, `TODO.md`, `content-asset-map.md`, and the existing source code before editing anything. Do not rebuild the project from scratch and do not replace the existing design system. Complete Phase 2 by integrating the three supplied real projects into `/work` and `/work/[slug]`, replacing the temporary Selected Work preview on the homepage with the three real projects, building `/about`, and building a dedicated `/contact` page using the existing editorial product design system. Preserve the current visual language, responsive behavior, accessibility rules, reduced-motion behavior, truthful-content policy, and existing asset mapping. Use only the project information in `content/project1-doc.json`, `content/project2-doc.json`, `content/project3-doc.json` and the supplied project images under `public/assets/projects/`. Do not invent metrics, testimonials, awards, certifications, client outcomes, dates, claims, or social/contact details. The three real projects are Peoria Hardwood Floors, Nicola, and AI Flooring Visualizer. Add structured project data in a reusable TypeScript content module, create reusable project-card and case-study components, add metadata and JSON-LD for the new routes, update `public/manus-routes.json` with `/`, `/work`, `/work/:slug`, `/about`, and `/contact`, and update sitemap/robots as appropriate. Use real external project links only when they are explicitly present in the source documents. Run typecheck, build, route checks, raw HTML/metadata checks, and responsive visual review before delivery. Update the Phase 2 report and TODO, commit all changes, and push everything to `main`. Do not begin Phase 3 deployment or add unsupported backend/contact form behavior unless explicitly requested.

## Source material already in this repository

The Google Drive folder used for Phase 2 was:

`https://drive.google.com/drive/folders/1CUIGAx67rFEd8ThLkvTDmEXFbC8KWoBq`

The folder contained three subfolders, each with one Google Doc and one PNG visual asset. Their extracted source documents are checked into the repository so the next agent does not need Drive access for the core implementation:

- `content/project1-doc.json`
- `content/project2-doc.json`
- `content/project3-doc.json`

The visual assets are:

- `public/assets/projects/peoria-hardwood-floors.png`
- `public/assets/projects/nicola.png`
- `public/assets/projects/ai-flooring-visualizer.png`

Each image is 1586×992 PNG and was visually inspected. They are presentation/collage-style project visuals containing the project name, product/site mockups, project summary, and implementation themes. Use them as the project hero/featured visual; do not redraw, annotate, or generate replacement images.

## Verified project content

### 1. Peoria Hardwood Floors

**Source document:** `content/project1-doc.json`  
**Image:** `/assets/projects/peoria-hardwood-floors.png`  
**Live website explicitly present in source:** `https://peoriahardwoodfloors.com`

- Title: Peoria Hardwood Floors
- Type: Website Redesign & Digital Experience
- Industry: Flooring / Home Services
- Short description: A redesigned digital experience for a hardwood flooring business, focused on clearer product discovery, organized finishes and stains, stronger gallery presentation, and a more intuitive responsive experience.
- Role: WordPress Developer · UI/UX Implementation · Content Structuring · Responsive Development
- Problem: Important business information and visual assets existed, but content was not presented clearly or consistently. Products, finishes, stains, and gallery content needed better organization and a more intuitive browsing experience.
- What was solved:
  - Restructured product and service content
  - Built organized product presentation
  - Added finishes and stain information
  - Organized and integrated gallery imagery
  - Improved page hierarchy and content flow
  - Refined responsive layouts for mobile and desktop
  - Focused on making the website easier for customers to explore
- Approach: Turned the available content into a clearer customer journey from discovering the company and services to exploring products, finishes, stains, and completed projects.
- Technology: WordPress · Elementor · Custom UI · Responsive Web Design

### 2. Nicola

**Source document:** `content/project2-doc.json`  
**Image:** `/assets/projects/nicola.png`  
**Live website explicitly present in source:** `https://faisalhossen.com/nicolav1/`

- Title: Nicola
- Type: Therapist Website · Design Reconstruction & WordPress Implementation
- Focus: Design Reconstruction · Component System · Responsive Development
- Short description: A warm, editorial therapist website reconstructed and implemented in WordPress with reusable components, responsive layouts, custom hero sections, and a stronger storytelling flow.
- Role: WordPress Developer · UI/UX Implementation · Design Reconstruction · Responsive Development
- Challenge: Translate an existing visual direction into a fully editable WordPress experience without losing the original personality, hierarchy, or storytelling flow.
- What was implemented:
  - Reconstructed the visual design into editable WordPress components
  - Built a reusable header and footer foundation
  - Implemented custom hero sections and content blocks
  - Developed the About page with improved storytelling flow
  - Created reusable page sections for consistency
  - Refined typography, spacing, colors, and visual hierarchy
  - Integrated responsive behavior across desktop, tablet, and mobile
  - Added subtle interactions and visual polish
  - Improved content flow without redesigning the brand direction
- Design direction: Warm, calm, human, and premium, using soft peach/apricot tones, editorial typography, and image-led storytelling rather than a generic corporate layout.
- Implementation approach: Visually accurate while remaining editable and maintainable, structured around reusable components.
- Technology: WordPress · Custom Builder Components · PHP · HTML · CSS · JavaScript · Responsive UI

### 3. AI Flooring Visualizer

**Source document:** `content/project3-doc.json`  
**Image:** `/assets/projects/ai-flooring-visualizer.png`  
**No public live URL was supplied in the source document. Do not invent one.**

- Title: AI Flooring Visualizer
- Type: AI-Powered Product Experience · Web Application
- Focus: AI · Web Application · Interactive UX · Lead Generation
- Short description: An AI-powered web application that lets homeowners upload their room photo, explore flooring options, and visualize different hardwood styles before requesting a quote.
- Role: Full-Stack Developer · AI Integration · UI/UX · Product Development
- Problem: Choosing a flooring style from samples and product photos can be difficult. Customers need to visualize different options in the context of their own room before making a decision.
- What was built:
  - Interactive room-photo upload experience
  - AI-powered flooring visualization
  - Flooring style and wood-species selection
  - Room and project type configuration
  - Finish, sheen, and flooring direction options
  - Before/after visualization experience
  - Responsive desktop and mobile interface
  - Quote/contact flow after visualization
  - Generation limits and lead-capture concept
  - Validation pipeline for uploaded images
  - API-based image generation architecture
- Flow: Upload → Configure → Generate → Compare → Take Action
- Product goal: Turn a traditionally difficult flooring decision into a simple, visual, interactive digital experience.
- Technology: Next.js · React · TypeScript · Tailwind CSS · AI Image Generation API · Responsive Product UX

## Current Phase 1 architecture

Existing important files and components:

- `app/layout.tsx`: root layout, Inter + DM Sans fonts, global metadata, global CSS import.
- `app/page.tsx`: current Home page. Replace only the temporary Selected Work section; preserve the rest unless a small navigation/content adjustment is needed.
- `app/globals.css`: all current design tokens and CSS classes. Extend it with Phase 2 classes instead of replacing the file.
- `app/robots.ts`: current robots metadata route.
- `app/sitemap.ts`: current sitemap route. Add the new static and dynamic routes if appropriate.
- `app/icon.svg`: site icon.
- `app.config.ts`: durable project logo URL; preserve it.
- `components/site/Header.tsx`: current header and mobile menu. Change navigation from section anchors to real routes where appropriate: Home `/`, Work `/work`, About `/about`, Contact `/contact`. Keep mobile navigation accessible.
- `components/site/Footer.tsx`: current footer. Add links to the new routes only where useful.
- `components/site/Button.tsx`: existing reusable CTA.
- `components/site/Reveal.tsx`: existing `motion/react` reveal wrapper with reduced-motion support.
- `components/site/SectionHeading.tsx`: existing section heading component.
- `components/site/CapabilityList.tsx`: existing capabilities list.
- `components/site/ProblemPlayground.tsx`: existing interactive problem selector; keep it on Home.
- `components/site/Workbench.tsx`: existing Workbench visual proof; keep it on Home.
- `content/site.ts`: existing site identity, problem states, principles, and capability data. Add project data in a separate file such as `content/projects.ts`; do not put large project objects directly inside route components.
- `lib/metadata.ts`: existing site metadata helper. Extend metadata patterns for route-specific titles/descriptions and dynamic project pages.
- `public/manus-routes.json`: currently only declares `/`. It must be updated after route creation.
- `public/assets/fahim-workbench.jpg`: existing real Fahim portrait.

## Required Phase 2 routes

### `/work`

Create a work index page that:

- Uses the existing Header/Footer and design system.
- Has a clear title such as “Selected work” or “A few problems I’ve helped make clearer.”
- Shows all three real projects using reusable project cards.
- Uses each supplied project image with meaningful alt text.
- Displays project title, type/focus, concise truthful description, role/focus tags, and a link to `/work/[slug]`.
- Uses only one external live-site link where explicitly verified, and labels it as an external live website. For AI Flooring Visualizer, do not show a live link.
- Has a responsive grid/list that does not squeeze desktop cards onto mobile.
- Keeps the existing editorial, quiet, premium visual language.

### `/work/[slug]`

Create a reusable dynamic case-study route with the following slugs:

- `/work/peoria-hardwood-floors`
- `/work/nicola`
- `/work/ai-flooring-visualizer`

Each detail page should include:

1. Breadcrumb or back link to `/work`.
2. Project label and title.
3. Type, role, focus, and technology metadata.
4. Supplied project hero image.
5. A “The problem” or “The challenge” section.
6. A “What I solved” or “What I built” section.
7. A “My approach” / “Implementation approach” section.
8. A structured result/impact section that describes the delivered work without inventing measurable outcomes. Use “What changed in the experience” or similar wording instead of fake metrics.
9. A clear next-project navigation link.
10. External live-site CTA only for Peoria and Nicola, using the exact URLs above and `target="_blank" rel="noreferrer"` if implemented.
11. Accessible image alt text and route-specific metadata.

Use `generateStaticParams()` or an equivalent static route strategy, `notFound()` for unknown slugs, and `generateMetadata()` from project data. Add `WebSite`/`CreativeWork` or `Article`-appropriate JSON-LD only when it is truthful and valid.

### Homepage Selected Work

Replace the current placeholder section with a real “Selected Work” section that:

- Shows exactly the three supplied projects.
- Uses the three supplied images.
- Includes one featured project treatment and two supporting project cards or an equally strong editorial composition.
- Links each card to its detail route.
- Keeps the existing “No invented numbers” trust language, but update copy so it no longer says that the proof library is still waiting for project evidence.
- Does not overload the Home page with all case-study content; keep it as an entry point.

### `/about`

Build a dedicated About page using the same design system. It should:

- Explain Fahim’s positioning as an independent digital problem solver.
- Explain how he combines web development, product thinking, UX, AI/automation, and SEO.
- Reuse the real portrait asset only where appropriate; do not create a fake biography.
- Use truthful, human, practical copy derived from the existing Home content and project roles.
- Include a short principles/working-style section.
- Link to Work and Contact.
- Do not invent location, years of experience, client count, awards, education, certifications, testimonials, or performance claims.

### `/contact`

Build a dedicated Contact page using the same design system. The supplied source did **not** include a verified email, contact URL, social URL, or form backend. Therefore:

- Do not invent an email address or social link.
- Do not create a fake form that claims to submit anywhere.
- Create a useful contact page with a clear heading, what kinds of problems are welcome, a transparent “contact link will be added once verified” state, and links back to Work/About.
- If the agent can find a verified contact method in the repository or directly supplied project source, use it only after confirming it is explicit and current. Otherwise leave the transparent placeholder and record it in the Phase 2 report.
- Do not enable database, authentication, email service, or server features without an explicit new request.

## Design and implementation rules

- Preserve the existing palette: `#F5F3EE` background, `#FBFAF7` surface, `#EEECE6` secondary surface, `#11130F` ink, `#6F716B` muted, `rgba(17,19,15,.11)` line, and `#B6FF45` accent.
- Keep the existing editorial website + modern product UI + premium personal portfolio movement.
- Use restrained radii and shadows. No excessive gradients, glassmorphism, WebGL, particles, parallax, cursor gimmicks, fake AI effects, autoplay sound, or scroll hijacking.
- Preserve mobile-first intentional composition, thumb-friendly controls, readable typography, and `prefers-reduced-motion` behavior.
- Keep Server Components by default. Use client components only for actual interactions.
- Keep content data structured and reusable.
- Use `next/image` for supplied images with meaningful `alt`, `sizes`, and sensible loading/priority behavior.
- Avoid adding dependencies unless necessary; existing dependencies are sufficient.
- Before first code edits, confirm host-managed diagnostics are registered with `webdev.config` GET `runtime/post-edit`. The current project previously used TypeScript/CSS/JSON diagnostics.

## Content safety / truthfulness rules

The content must remain evidence-led. The Drive documents are the only source of truth for project details. Do not convert descriptive project goals into verified business outcomes. Do not add percentage improvements, traffic, conversion, revenue, client praise, team size, dates, or performance claims. If something is not in the source, omit it or label it as a design intention/concept.

## Route manifest requirements

Update `public/manus-routes.json` to include at minimum:

```json
{
  "routes": [
    {"path":"/","title":"Fahim — Digital Problem Solver"},
    {"path":"/work","title":"Selected Work — Fahim"},
    {"path":"/work/:slug","title":"Project Case Study — Fahim"},
    {"path":"/about","title":"About Fahim"},
    {"path":"/contact","title":"Contact Fahim"}
  ]
}
```

The dynamic route must be declared as `/work/:slug`, not as invented project IDs. Keep the manifest synchronized with source routes.

## Validation requirements before push

Run and record:

```bash
pnpm exec tsc --noEmit
rm -rf .next && pnpm build
pnpm dev
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/work
curl -I http://127.0.0.1:3000/work/peoria-hardwood-floors
curl -I http://127.0.0.1:3000/work/nicola
curl -I http://127.0.0.1:3000/work/ai-flooring-visualizer
curl -I http://127.0.0.1:3000/about
curl -I http://127.0.0.1:3000/contact
curl http://127.0.0.1:3000/manus-routes.json
curl -I http://127.0.0.1:3000/sitemap.xml
curl -I http://127.0.0.1:3000/robots.txt
```

Also verify that:

- The three supplied PNGs return HTTP 200 from their public paths.
- Every implemented page has one clear H1.
- Every project detail page has route-specific title/description and image alt text.
- The raw HTML includes Open Graph/Twitter metadata where intended.
- Unknown project slugs return a real 404 through `notFound()`.
- Desktop and mobile layouts are visually reviewed. Pay particular attention to project image cropping, card readability, mobile navigation, long project titles, and external-link labeling.
- No console/build/type errors remain.

## Documentation and Git deliverables

Update:

- `TODO.md`: mark only verified Phase 2 outcomes complete.
- `PHASE-1-REPORT.md`: do not rewrite history; add a Phase 2 section or create `PHASE-2-REPORT.md` describing delivered routes, content evidence, validation, and remaining limitations.
- `content-asset-map.md`: add all three project images, source document IDs, local paths, and their intended placements.
- `README.md`: mention the new routes and the remaining verified-contact limitation.

Commit all source, content, assets, route declarations, and documentation. Push to the repository’s `main` branch. Use a descriptive commit message such as:

`Integrate real projects and add work about contact routes`

Do not force-push, delete branches, or publish/deploy Phase 3 unless explicitly requested.

## Future phases after Phase 2

Phase 3 should be a separate approved phase. It may include final content polish, verified contact method, production origin configuration, public metadata verification, deployment/publish, and final accessibility/performance hardening. It must not be started automatically after Phase 2. The next agent should stop after pushing Phase 2 and report the exact commit SHA, repository URL, routes, validation results, and remaining missing inputs.

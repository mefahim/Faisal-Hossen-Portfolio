import { projects } from "../content/projects";
import { capabilities, contactDetails, problemStates, site, thinkingPrinciples } from "../content/site";

export const settings = { site, contactDetails, problemStates, thinkingPrinciples, capabilities };

export const pageSeeds = [
  { key: "home", route: "/", title: "Faisal Hossen — Digital Problem Solver", sections: [
    { key: "hero", type: "hero", position: 0, content: { eyebrow: `${site.label} · ${site.context}`, heading: site.positioning, supporting: site.supporting } },
    { key: "workbench", type: "workbench", position: 1, content: { heading: "Show the thinking, not just the finished screen." } },
    { key: "selected-work", type: "project-index", position: 2, content: { projectSlugs: projects.map((project) => project.slug) } },
  ] },
  { key: "work", route: "/work", title: "Selected Work", sections: [{ key: "hero", type: "hero", position: 0, content: { heading: "A few problems I've helped make clearer.", supporting: "Three project stories from the available source material." } }] },
  { key: "about", route: "/about", title: "About Faisal Hossen", sections: [{ key: "point-of-view", type: "copy", position: 0, content: { heading: "Start with the problem, not the platform.", supporting: site.supporting, principles: thinkingPrinciples } }] },
  { key: "contact", route: "/contact", title: "Contact Faisal Hossen", sections: [{ key: "contact-intro", type: "copy", position: 0, content: { supporting: "Start a conversation about a website, product experience, AI, automation, UX, or SEO problem." } }] },
  ...projects.map((project) => ({ key: `work/${project.slug}`, route: `/work/${project.slug}`, title: project.title, sections: [{ key: "case-study", type: "case-study", position: 0, content: { slug: project.slug, title: project.title, summary: project.summary, challenge: project.challenge, solutions: project.solutions, approach: project.approach } }] })),
];

export const navSeeds = [
  { location: "header", label: "Home", href: "/", position: 0, visible: true },
  { location: "header", label: "Work", href: "/work", position: 1, visible: true },
  { location: "header", label: "About", href: "/about", position: 2, visible: true },
  { location: "header", label: "Contact", href: "/contact", position: 3, visible: true },
  { location: "footer", label: "Work", href: "/work", position: 0, visible: true },
  { location: "footer", label: "About", href: "/about", position: 1, visible: true },
  { location: "footer", label: "Contact", href: "/contact", position: 2, visible: true },
];

export const seoSeeds = [
  { route: "/", title: site.positioning, description: site.supporting },
  { route: "/work", title: "Selected Work", description: "A selection of verified project notes covering web experiences, reusable systems, and interactive product work." },
  { route: "/about", title: "About Faisal Hossen", description: "The point of view, working style, and practical approach behind Faisal Hossen’s digital work." },
  { route: "/contact", title: "Contact Faisal Hossen", description: "Start a conversation with Faisal Hossen about a website, product experience, AI, automation, UX, or SEO problem." },
  ...projects.map((project) => ({ route: `/work/${project.slug}`, title: project.title, description: project.summary })),
].map(({ route, title, description }) => ({ route, title, description, robots: "index,follow" }));

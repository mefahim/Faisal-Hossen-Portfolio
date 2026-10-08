export type Project = {
  slug: string;
  number: string;
  title: string;
  type: string;
  category: string;
  summary: string;
  role: string;
  focus: string[];
  challengeLabel: string;
  challenge: string;
  solutionLabel: string;
  solutions: string[];
  approachLabel: string;
  approach: string;
  experienceChange: string;
  technology: string[];
  image: string;
  imageAlt: string;
  externalUrl?: string;
  externalLabel?: string;
};

export const projects: Project[] = [
  {
    slug: "peoria-hardwood-floors",
    number: "01",
    title: "Peoria Hardwood Floors",
    type: "Website Redesign & Digital Experience",
    category: "Flooring / Home Services",
    summary:
      "A redesigned digital experience for a hardwood flooring business, focused on clearer product discovery, organized finishes and stains, stronger gallery presentation, and a more intuitive responsive experience.",
    role: "WordPress Developer · UI/UX Implementation · Content Structuring · Responsive Development",
    focus: ["Content structure", "Product discovery", "Responsive web design"],
    challengeLabel: "The problem",
    challenge:
      "The existing website had important business information and visual assets, but the content was not presented in a clear and consistent way. Products, finishes, stains, and gallery content needed better organization and a more intuitive browsing experience.",
    solutionLabel: "What I solved",
    solutions: [
      "Restructured product and service content",
      "Built organized product presentation",
      "Added finishes and stain information",
      "Organized and integrated gallery imagery",
      "Improved page hierarchy and content flow",
      "Refined responsive layouts for mobile and desktop",
      "Focused on making the website easier for customers to explore",
    ],
    approachLabel: "My approach",
    approach:
      "Instead of simply rebuilding pages, I focused on turning the available content into a clearer customer journey — from discovering the company and its services to exploring flooring products, finishes, stains, and completed projects.",
    experienceChange:
      "The site is organized around a clearer path from the company and its services to products, finishes, stains, and project imagery. The work focuses on making the available information easier to browse across screen sizes.",
    technology: ["WordPress", "Elementor", "Custom UI", "Responsive Web Design"],
    image: "/assets/projects/peoria-hardwood-floors.png",
    imageAlt: "Peoria Hardwood Floors project visual showing a flooring website redesign and product presentation",
    externalUrl: "https://peoriahardwoodfloors.com",
    externalLabel: "Visit the verified live website",
  },
  {
    slug: "nicola",
    number: "02",
    title: "Nicola",
    type: "Therapist Website · Design Reconstruction & WordPress Implementation",
    category: "Design Reconstruction / Component System",
    summary:
      "A warm, editorial therapist website reconstructed and implemented in WordPress with reusable components, responsive layouts, custom hero sections, and a stronger storytelling flow.",
    role: "WordPress Developer · UI/UX Implementation · Design Reconstruction · Responsive Development",
    focus: ["Editorial storytelling", "Reusable components", "Responsive development"],
    challengeLabel: "The challenge",
    challenge:
      "The project required translating an existing visual direction into a fully editable WordPress experience without losing the original personality, visual hierarchy, or storytelling flow. The goal was to create a reusable system that could maintain visual consistency across the website.",
    solutionLabel: "What I implemented",
    solutions: [
      "Reconstructed the visual design into editable WordPress components",
      "Built a reusable header and footer foundation",
      "Implemented custom hero sections and content blocks",
      "Developed the About page with improved storytelling flow",
      "Created reusable page sections for consistent design",
      "Refined typography, spacing, colors, and visual hierarchy",
      "Integrated responsive behavior across desktop, tablet, and mobile",
      "Added subtle interactions and visual polish",
      "Improved content flow without redesigning the brand direction",
    ],
    approachLabel: "Implementation approach",
    approach:
      "I focused on making the design visually accurate while keeping the website editable and maintainable. The implementation was structured around reusable components so future content could be updated without rebuilding the page from scratch.",
    experienceChange:
      "The visual direction is carried through a reusable, editable system rather than a collection of isolated page reproductions. Warm, calm, human, and premium cues remain central to the experience.",
    technology: ["WordPress", "Custom Builder Components", "PHP", "HTML", "CSS", "JavaScript", "Responsive UI"],
    image: "/assets/projects/nicola.png",
    imageAlt: "Nicola project visual showing a warm editorial therapist website reconstruction",
    externalUrl: "https://faisalhossen.com/nicolav1/",
    externalLabel: "Visit the verified live website",
  },
  {
    slug: "ai-flooring-visualizer",
    number: "03",
    title: "AI Flooring Visualizer",
    type: "AI-Powered Product Experience · Web Application",
    category: "AI / Interactive UX / Lead Generation",
    summary:
      "An AI-powered web application that lets homeowners upload their room photo, explore flooring options, and visualize different hardwood styles before requesting a quote.",
    role: "Full-Stack Developer · AI Integration · UI/UX · Product Development",
    focus: ["AI integration", "Interactive product UX", "Visual decision-making"],
    challengeLabel: "The problem",
    challenge:
      "Choosing a flooring style from samples and product photos can be difficult. Customers need to visualize different options in the context of their own room before making a decision.",
    solutionLabel: "What I built",
    solutions: [
      "Interactive room-photo upload experience",
      "AI-powered flooring visualization",
      "Flooring style and wood-species selection",
      "Room and project type configuration",
      "Finish, sheen, and flooring direction options",
      "Before/after visualization experience",
      "Responsive desktop and mobile interface",
      "Quote/contact flow after visualization",
      "Generation limits and lead-capture concept",
      "Validation pipeline for uploaded images",
      "API-based image generation architecture",
    ],
    approachLabel: "How it works",
    approach:
      "Users upload a photo of their room, select their preferred flooring characteristics, and generate visual variations to explore different possibilities before requesting a quote. The core flow is Upload → Configure → Generate → Compare → Take Action.",
    experienceChange:
      "The product turns a difficult flooring decision into a sequence people can inspect: upload a room, configure preferences, generate a variation, compare possibilities, and decide what to do next. No public live URL was supplied for this project.",
    technology: ["Next.js", "React", "TypeScript", "Tailwind CSS", "AI Image Generation API", "Responsive Product UX"],
    image: "/assets/projects/ai-flooring-visualizer.png",
    imageAlt: "AI Flooring Visualizer project visual showing an interactive room and flooring visualization experience",
  },
];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

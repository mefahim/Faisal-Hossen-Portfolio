import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudy } from "@/components/site/CaseStudy";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { getProject, projects } from "@/content/projects";
import { createPageMetadata } from "@/lib/metadata";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return { title: "Project not found", robots: { index: false, follow: false } };
  }
  return createPageMetadata({
    title: project.title,
    description: project.summary,
    path: `/work/${project.slug}`,
    image: project.image,
    type: "article",
  });
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const currentIndex = projects.findIndex((item) => item.slug === project.slug);
  const nextProject = projects[(currentIndex + 1) % projects.length];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    image: project.image,
    about: project.category,
    creator: { "@type": "Person", name: "Fahim" },
    keywords: project.focus.join(", "),
  };

  return (
    <>
      <Header />
      <CaseStudy project={project} nextProject={nextProject} />
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}

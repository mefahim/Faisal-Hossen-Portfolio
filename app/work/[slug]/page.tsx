import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudy } from "@/components/site/CaseStudy";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { projects as fileProjects } from "@/content/projects";
import { createPageMetadata } from "@/lib/metadata";
import { applyPublishedSeo } from "@/lib/server/content/metadata";
import { getPublishedProject, getPublishedProjects } from "@/lib/server/content/public";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return fileProjects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) {
    return { title: "Project not found", robots: { index: false, follow: false } };
  }
  const fallback = createPageMetadata({
    title: project.title,
    description: project.summary,
    path: `/work/${project.slug}`,
    image: project.image,
    type: "article",
  });
  return applyPublishedSeo(`/work/${slug}`, fallback);
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const projects = await getPublishedProjects();
  const project = projects.find((item) => item.slug === slug);
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
    creator: { "@type": "Person", name: "Faisal Hossen" },
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

import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { ProjectGrid } from "@/components/site/ProjectGrid";
import { Reveal } from "@/components/site/Reveal";
import { projects } from "@/content/projects";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Selected Work",
  description: "A selection of verified project notes covering web experiences, reusable systems, and interactive product work.",
  path: "/work",
});

const structuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Selected Work — Fahim",
  description: "A selection of verified project notes covering web experiences, reusable systems, and interactive product work.",
  hasPart: projects.map((project) => ({
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    url: `/work/${project.slug}`,
  })),
};

export default function WorkPage() {
  return (
    <>
      <Header />
      <main className="page-shell work-page">
        <section className="section-shell page-hero">
          <Reveal>
            <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Selected work / project notes</p>
            <h1>A few problems I&apos;ve helped make clearer.</h1>
            <p className="page-hero-supporting">Three project stories from the available source material. No invented numbers, testimonials, or outcomes — just the problem, the implementation, and the experience it was designed to create.</p>
          </Reveal>
        </section>
        <section className="section-shell work-index-section" aria-labelledby="work-index-title">
          <div className="section-rail">
            <span className="eyebrow">01 / the index</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">The useful details are in the notes.</span>
          </div>
          <div className="section-main">
            <Reveal>
              <div className="work-index-heading">
                <div><p className="eyebrow">Three directions</p><h2 id="work-index-title">Different surfaces.<br /><em>Same standard.</em></h2></div>
                <p>From a clearer flooring website to an editable therapist experience and an AI product flow, each project starts with understanding what people need to do next.</p>
              </div>
            </Reveal>
            <Reveal delay={0.08}><ProjectGrid projects={projects} /></Reveal>
          </div>
        </section>
        <section className="section-shell work-index-footer-note">
          <ArrowRight aria-hidden="true" size={18} />
          <p>Each project page keeps the source boundaries visible. If a result is not verified, it is not presented as a metric.</p>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/site/Button";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { site, thinkingPrinciples } from "@/content/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "About Fahim",
  description: "About Fahim’s practical, independent approach to web development, product thinking, UX, AI, automation, and SEO.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="page-shell about-page">
        <section className="section-shell page-hero about-hero">
          <Reveal>
            <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> About / how the work is shaped</p>
            <h1>Digital work should feel considered before it feels complicated.</h1>
            <p className="page-hero-supporting">I&apos;m an independent digital problem solver who combines web development, product thinking, UX, AI, automation, and SEO to make the next useful step clearer.</p>
          </Reveal>
        </section>

        <section className="section-shell about-story-section" aria-labelledby="about-story-title">
          <div className="about-portrait-wrap">
            <Image src="/assets/fahim-workbench.jpg" alt="Fahim in an outdoor portrait" fill sizes="(max-width: 800px) 100vw, 40vw" className="about-portrait" />
            <span className="photo-caption">The person behind the systems</span>
          </div>
          <div className="about-story-copy">
            <Reveal>
              <SectionHeading eyebrow="The point of view" title="Start with the problem, not the platform." body={site.supporting} />
            </Reveal>
            <Reveal delay={0.08}>
              <div className="about-copy-stack">
                <p>Good digital work does more than put information on a screen. It helps people understand what is happening, decide what matters, and move forward without unnecessary friction.</p>
                <p>The work can take the form of a website, a product flow, an AI-powered interaction, or a clearer information system. The shape changes with the problem; the standard stays practical, calm, and specific.</p>
                <div className="about-capability-note"><Check aria-hidden="true" size={17} /><span>{site.capabilities.join(" · ")}</span></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section-shell about-principles-section" aria-labelledby="about-principles-title">
          <div className="section-rail">
            <span className="eyebrow">01 / working style</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">Simple principles, applied carefully.</span>
          </div>
          <div className="section-main">
            <Reveal><SectionHeading eyebrow="How I work" title="Clarity is a design decision." body="The goal is not to make every project look the same. It is to give every project a clearer reason for being." /></Reveal>
            <div className="about-principle-list">
              {thinkingPrinciples.map((principle, index) => (
                <Reveal key={principle.index} delay={index * 0.06}>
                  <article className="about-principle-row">
                    <span>{principle.index}</span>
                    <div><h2>{principle.title}</h2><p>{principle.body}</p></div>
                    <ArrowRight aria-hidden="true" size={18} />
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell about-links-section" aria-labelledby="about-links-title">
          <div><p className="eyebrow">Keep exploring</p><h2 id="about-links-title">See the work, or bring a problem.</h2></div>
          <div className="about-links-actions"><Button href="/work">Explore selected work</Button><Button href="/contact" variant="secondary">Go to contact</Button></div>
        </section>
      </main>
      <Footer />
    </>
  );
}

import { ArrowDownRight, ArrowRight, Check, Globe2, Sparkles } from "lucide-react";
import { Button } from "@/components/site/Button";
import { CapabilityList } from "@/components/site/CapabilityList";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { ProblemPlayground } from "@/components/site/ProblemPlayground";
import { ProjectGrid } from "@/components/site/ProjectGrid";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Workbench } from "@/components/site/Workbench";
import { getPublishedPage, getPublishedProjects, getPublishedSettings, getSection } from "@/lib/server/content/public";
import { siteMetadata } from "@/lib/metadata";
import { applyPublishedSeo } from "@/lib/server/content/metadata";

export async function generateMetadata() {
  return applyPublishedSeo("/", siteMetadata);
}

export default async function HomePage() {
  const [settings, projects, page] = await Promise.all([getPublishedSettings(), getPublishedProjects(), getPublishedPage("/")]);
  const { site, contactDetails, thinkingPrinciples } = settings;
  const hero = getSection(page, "hero");
  const selectedWork = getSection(page, "selected-work");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Person", name: site.name, jobTitle: site.label, description: site.supporting, knowsAbout: site.capabilities },
      { "@type": "WebSite", name: `${site.name} — Digital Problem Solver`, description: site.supporting },
    ],
  };
  return (
    <>
      <Header />
      <main id="top">
        <section className="hero section-shell">
          <div className="hero-copy">
            <Reveal>
              <p className="eyebrow hero-eyebrow"><span className="status-dot" aria-hidden="true" /> {typeof hero.eyebrow === "string" ? hero.eyebrow : `${site.label} · ${site.context}`}</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1>{typeof hero.heading === "string" ? hero.heading : site.positioning}</h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="hero-supporting">{typeof hero.supporting === "string" ? hero.supporting : site.supporting}</p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="hero-actions">
                <Button href="/contact">Start a project</Button>
                <Button href="/work" variant="secondary">Explore my work</Button>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="hero-capabilities" aria-label="Capabilities">
                {site.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
              </div>
            </Reveal>
          </div>
          <div className="hero-side-note">
            <span className="hero-side-line" aria-hidden="true" />
            <p>Technology is a capability. Problem-solving is the identity.</p>
            <ArrowDownRight aria-hidden="true" size={20} />
          </div>
        </section>

        <section className="section-shell workbench-section" aria-labelledby="workbench-title">
          <div className="section-rail">
            <span className="eyebrow">01 / visual proof</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">A little context before the work</span>
          </div>
          <div className="section-main">
            <Reveal>
              <SectionHeading
                eyebrow="Workbench"
                title="Show the thinking, not just the finished screen."
                body="A personal website should make the way of working visible. This is a small window into how I frame, simplify, and build."
              />
            </Reveal>
            <Reveal delay={0.08}>
              <Workbench />
            </Reveal>
          </div>
        </section>

        <section className="contrast-band" aria-labelledby="proof-title">
          <div className="section-shell contrast-inner">
            <Reveal>
              <div className="contrast-mark"><Sparkles aria-hidden="true" size={20} /><span>Proof, without theatre</span></div>
              <h2 id="proof-title">No invented numbers.<br /><em>Just useful work.</em></h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="contrast-copy">
                <p>This site is being built as a product demonstration: a place to see the judgement behind the interface, the care behind the details, and the person behind the work.</p>
                <p className="contrast-footnote"><Check aria-hidden="true" size={17} /> Clear about what is verified — and what is still being built.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section-shell split-section" id="capabilities" aria-labelledby="capabilities-title">
          <div className="section-rail">
            <span className="eyebrow">02 / what I build</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">The right shape for the problem</span>
          </div>
          <div className="section-main capabilities-main">
            <Reveal>
              <SectionHeading
                eyebrow="Capabilities"
                title="A useful blend of design judgement and technical range."
                body="The tools change. The standard stays the same: make the right thing clearer, calmer, and easier to use."
              />
            </Reveal>
            <Reveal delay={0.08}><CapabilityList capabilities={settings.capabilities} /></Reveal>
          </div>
        </section>

        <section className="section-shell playground-section" aria-labelledby="playground-title">
          <div className="playground-intro">
            <Reveal>
              <p className="eyebrow">03 / a small playground</p>
              <h2 id="playground-title">Start with the problem.<br /><em>Not the platform.</em></h2>
              <p>Choose the situation that sounds familiar. You will get a useful first question, not a quiz score.</p>
            </Reveal>
          </div>
          <Reveal delay={0.08} className="playground-wrap"><ProblemPlayground problemStates={settings.problemStates} /></Reveal>
        </section>

        <section className="section-shell thinking-section" aria-labelledby="thinking-title">
          <div className="section-rail">
            <span className="eyebrow">04 / how I think</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">Simple principles, applied carefully</span>
          </div>
          <div className="section-main">
            <Reveal>
              <SectionHeading
                eyebrow="Working principles"
                title="Good digital work makes progress feel possible."
                body="Not every problem needs more software. It needs a better question, a clearer path, and enough care to make the next step hold up."
              />
            </Reveal>
            <div className="principles-list">
              {thinkingPrinciples.map((principle, index) => (
                <Reveal key={principle.index} delay={index * 0.06}>
                  <article className="principle-row">
                    <span className="principle-index">{principle.index}</span>
                    <div><h3>{principle.title}</h3><p>{principle.body}</p></div>
                    <ArrowRight aria-hidden="true" size={19} />
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell selected-work-section" id="selected-work" aria-labelledby="selected-work-title">
          <div className="section-rail">
            <span className="eyebrow">05 / selected work</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">Real project notes, kept honest.</span>
          </div>
          <div className="section-main">
            <Reveal>
              <SectionHeading
                eyebrow="Project notes"
                title={typeof selectedWork.title === "string" ? selectedWork.title : "Useful work, in three different shapes."}
                body={typeof selectedWork.body === "string" ? selectedWork.body : "A flooring website, a therapist experience, and an AI product flow. Start with the case study that feels closest to the problem in front of you."}
              />
            </Reveal>
            <Reveal delay={0.08}><ProjectGrid projects={projects} className="home-project-grid" /></Reveal>
            <div className="section-action"><Button href="/work" variant="secondary">See all project notes</Button></div>
          </div>
        </section>

        <section className="section-shell about-preview" id="about-preview" aria-labelledby="about-preview-title">
          <div>
            <p className="eyebrow">About / the practice</p>
            <h2 id="about-preview-title">A digital home should still feel human.</h2>
          </div>
          <div className="about-preview-copy">
            <p>There is a person behind the systems: curious, practical, and interested in the details that make a digital experience feel easy.</p>
            <span className="inline-note"><Globe2 aria-hidden="true" size={16} /> Independent · worldwide</span>
            <Button href="/about" variant="text">Read about the practice</Button>
          </div>
        </section>

        <section className="cta-band" id="contact" aria-labelledby="contact-title">
          <div className="section-shell cta-inner">
            <Reveal>
              <p className="eyebrow">06 / start a conversation</p>
              <h2 id="contact-title">Have a problem<br /><em>worth solving?</em></h2>
              <p className="cta-supporting">No pressure. No complicated pitch. Just a conversation about the problem.</p>
              <div className="cta-actions">
                <Button href="/contact">Contact page</Button>
                <span className="cta-note" id="contact-note">Use the form or call {contactDetails.phone}.</span>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}

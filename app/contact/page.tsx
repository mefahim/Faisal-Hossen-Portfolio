import type { Metadata } from "next";
import { ArrowRight, Check, CircleSlash2 } from "lucide-react";
import { Button } from "@/components/site/Button";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Reveal } from "@/components/site/Reveal";
import { site } from "@/content/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Contact Fahim",
  description: "A transparent contact page for starting a conversation about a website, product experience, AI, automation, UX, or SEO problem.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="page-shell contact-page">
        <section className="section-shell page-hero contact-hero">
          <Reveal>
            <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Contact / start with the problem</p>
            <h1>Have a problem worth solving?</h1>
            <p className="page-hero-supporting">No pressure. No complicated pitch. Share the situation, the people involved, and the next step that feels stuck.</p>
          </Reveal>
        </section>

        <section className="section-shell contact-grid" aria-labelledby="contact-details-title">
          <div className="contact-panel contact-panel-primary">
            <p className="eyebrow">A transparent note</p>
            <CircleSlash2 aria-hidden="true" size={28} strokeWidth={1.3} />
            <h2 id="contact-details-title">The verified contact link is not in the current source material.</h2>
            <p>{site.contactPlaceholder} This page does not submit a form or pretend to send a message anywhere.</p>
            <div className="contact-placeholder"><span className="status-dot" aria-hidden="true" /> Contact details will be added once verified.</div>
          </div>
          <div className="contact-panel contact-panel-secondary">
            <p className="eyebrow">Good problems to bring</p>
            <ul className="contact-list">
              {[
                "A website that needs a clearer digital front door",
                "A product or workflow that feels harder than it should",
                "An AI or automation idea that needs a useful shape",
                "An experience that should be easier to find, understand, or trust",
              ].map((item) => <li key={item}><Check aria-hidden="true" size={16} /><span>{item}</span></li>)}
            </ul>
          </div>
        </section>

        <section className="section-shell contact-links-section" aria-labelledby="contact-links-title">
          <div><p className="eyebrow">While that link is being verified</p><h2 id="contact-links-title">Read the work or learn how the practice is shaped.</h2></div>
          <div className="contact-links-actions"><Button href="/work">Explore selected work</Button><Button href="/about" variant="secondary">About Fahim</Button></div>
        </section>

        <section className="section-shell contact-note-band"><ArrowRight aria-hidden="true" size={18} /><p>There is no fake form, inbox, social link, or backend behind this page. The boundary is intentional until a current contact method is confirmed.</p></section>
      </main>
      <Footer />
    </>
  );
}

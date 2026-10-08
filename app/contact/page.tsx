import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Facebook, Github, Instagram, Linkedin, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/ContactForm";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Reveal } from "@/components/site/Reveal";
import { createPageMetadata } from "@/lib/metadata";
import { applyPublishedSeo } from "@/lib/server/content/metadata";
import { getPublishedPage, getPublishedSettings, getSection } from "@/lib/server/content/public";

export async function generateMetadata(): Promise<Metadata> {
  const fallback = createPageMetadata({ title: "Contact Faisal Hossen", description: "Start a conversation with Faisal Hossen about a website, product experience, AI, automation, UX, or SEO problem.", path: "/contact" });
  return applyPublishedSeo("/contact", fallback);
}

function SocialIcon({ label }: { label: string }) {
  if (label === "Facebook") return <Facebook aria-hidden="true" size={17} />;
  if (label === "Instagram") return <Instagram aria-hidden="true" size={17} />;
  if (label === "GitHub") return <Github aria-hidden="true" size={17} />;
  return <Linkedin aria-hidden="true" size={17} />;
}

export default async function ContactPage() {
  const [settings, page] = await Promise.all([getPublishedSettings(), getPublishedPage("/contact")]);
  const contactDetails = settings.contactDetails;
  const hero = getSection(page, "hero");
  return (
    <>
      <Header />
      <main className="page-shell contact-page">
        <section className="section-shell page-hero contact-hero">
          <Reveal>
            <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> Contact / start with the problem</p>
            <h1>{typeof hero.heading === "string" ? hero.heading : "Have a problem worth solving?"}</h1>
            <p className="page-hero-supporting">{typeof hero.supporting === "string" ? hero.supporting : "Tell me what feels stuck, who it affects, and what a better next step could look like."}</p>
          </Reveal>
        </section>

        <section className="section-shell contact-work-section" aria-labelledby="contact-form-title">
          <div className="section-rail">
            <span className="eyebrow">01 / let&apos;s talk</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">A clear first note is enough.</span>
          </div>
          <div className="contact-work-main">
            <div className="contact-form-intro">
              <p className="eyebrow">Start a conversation</p>
              <h2 id="contact-form-title">Bring the situation.<br /><em>We&apos;ll find the shape.</em></h2>
              <p>Share a little context and I&apos;ll have a better starting point for the conversation. No complicated pitch required.</p>
            </div>
            <ContactForm />
          </div>
        </section>

        <section className="section-shell contact-details-section" aria-labelledby="contact-details-title">
          <div className="section-rail">
            <span className="eyebrow">02 / another way in</span>
            <span className="rail-rule" aria-hidden="true" />
            <span className="rail-caption">Prefer a direct line?</span>
          </div>
          <aside className="contact-details-card">
            <div className="contact-portrait-wrap">
              <Image src="/assets/about/portrait-smile.png" alt="Faisal Hossen standing by the sea" fill sizes="(max-width: 800px) 100vw, 38vw" className="contact-portrait" />
            </div>
            <div className="contact-details-copy">
              <p className="eyebrow">Prefer another way?</p>
              <h2 id="contact-details-title">A useful conversation can start simply.</h2>
              <a className="contact-phone" href={contactDetails.phoneHref} aria-label={`Call Faisal Hossen at ${contactDetails.phone}`}>
                <Phone aria-hidden="true" size={18} />
                <span><small>Phone</small><strong>{contactDetails.phone}</strong></span>
                <ArrowUpRight aria-hidden="true" size={17} />
              </a>
              <div className="contact-socials" aria-label="Faisal Hossen social links">
                {contactDetails.socialLinks.map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noreferrer" aria-label={`${link.label} — opens in a new tab`}>
                    <SocialIcon label={link.label} />
                    <span>{link.label}</span>
                    <ArrowUpRight aria-hidden="true" size={14} />
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="section-shell contact-note-band"><ArrowRight aria-hidden="true" size={18} /><p>The form validates in the browser and on the server. Email delivery uses environment-based provider settings; no secret or invented email address is stored in the frontend.</p></section>
      </main>
      <Footer />
    </>
  );
}

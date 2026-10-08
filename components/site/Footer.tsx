import Link from "next/link";
import { ArrowUpRight, Facebook, Github, Instagram, Linkedin, Phone } from "lucide-react";
import { getPublishedNavigation, getPublishedSettings } from "@/lib/server/content/public";

function SocialIcon({ label }: { label: string }) {
  if (label === "Facebook") return <Facebook aria-hidden="true" size={15} />;
  if (label === "Instagram") return <Instagram aria-hidden="true" size={15} />;
  if (label === "GitHub") return <Github aria-hidden="true" size={15} />;
  return <Linkedin aria-hidden="true" size={15} />;
}

export async function Footer() {
  const [settings, links] = await Promise.all([getPublishedSettings(), getPublishedNavigation("footer")]);
  const { contactDetails, site } = settings;
  return <footer className="site-footer"><div className="footer-top">
    <div><Link className="wordmark footer-wordmark" href="/" aria-label={`${site.name} home`}>{site.name.toUpperCase()}<span aria-hidden="true">·</span></Link><p className="footer-note">A calm digital partner for problems worth solving.</p></div>
    <div className="footer-contact-block"><a className="footer-phone" href={contactDetails.phoneHref} aria-label={`Call ${site.name} at ${contactDetails.phone}`}><Phone aria-hidden="true" size={15}/><span>{contactDetails.phone}</span></a>
      <nav className="footer-socials" aria-label="Social links">{contactDetails.socialLinks.map((link)=><a key={link.label} href={link.href} target="_blank" rel="noreferrer" aria-label={`${link.label} — opens in a new tab`}><SocialIcon label={link.label}/><span>{link.label}</span></a>)}</nav>
    </div><nav className="footer-nav" aria-label="Footer navigation">{links.map((link)=><Link key={`${link.href}:${link.label}`} href={link.href}>{link.label}</Link>)}<Link className="footer-link" href="/">Back to top <ArrowUpRight aria-hidden="true" size={16}/></Link></nav>
  </div><div className="footer-bottom"><p>© {new Date().getFullYear()} {site.name}. Built with intent.</p><p>Web · UX · Systems</p></div></footer>;
}

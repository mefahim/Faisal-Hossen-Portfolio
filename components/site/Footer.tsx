import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Link className="wordmark footer-wordmark" href="/" aria-label="Faisal Hossen home">
            FAISAL HOSSEN<span aria-hidden="true">·</span>
          </Link>
          <p className="footer-note">A calm digital partner for problems worth solving.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <Link href="/work">Work</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link className="footer-link" href="/">
            Back to top <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} {site.name}. Built with intent.</p>
        <p>Web · UX · Systems</p>
      </div>
    </footer>
  );
}

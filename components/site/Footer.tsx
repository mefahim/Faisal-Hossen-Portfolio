import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Link className="wordmark footer-wordmark" href="#top" aria-label="Fahim home">
            FAHIM<span aria-hidden="true">·</span>
          </Link>
          <p className="footer-note">A calm digital partner for problems worth solving.</p>
        </div>
        <a className="footer-link" href="#top">
          Back to top <ArrowUpRight aria-hidden="true" size={16} />
        </a>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} {site.name}. Built with intent.</p>
        <p>Web · UX · Systems</p>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

export type PublicNavLink = { href: string; label: string };
export function HeaderInteractive({ links, siteName }: { links: PublicNavLink[]; siteName: string }) {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="header-inner">
    <Link className="wordmark" href="/" aria-label={`${siteName} home`}>{siteName.toUpperCase()}<span aria-hidden="true">·</span></Link>
    <nav className="desktop-nav" aria-label="Primary navigation">{links.map((link) => <Link key={`${link.href}:${link.label}`} href={link.href}>{link.label}</Link>)}</nav>
    <div className="header-actions"><Link className="header-project-link" href="/contact">Start a project <span aria-hidden="true">↗</span></Link>
      <button className="menu-trigger" type="button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen((current) => !current)}>{open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}</button>
    </div>
  </div>{open ? <div className="mobile-nav-panel" id="mobile-navigation"><nav aria-label="Mobile navigation">{links.map((link) => <Link key={`${link.href}:${link.label}`} href={link.href} onClick={() => setOpen(false)}><span>{link.label}</span><span aria-hidden="true">↗</span></Link>)}</nav><Button href="/contact" variant="primary" className="mobile-nav-cta" onClick={() => setOpen(false)}>Start a project</Button></div> : null}</header>;
}

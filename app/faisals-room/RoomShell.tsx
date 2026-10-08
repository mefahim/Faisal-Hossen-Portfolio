"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, Archive, BarChart3, ChevronRight, FileText, FolderKanban, Image, LayoutDashboard, LogOut, Menu, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

const navigation = [
  { href: "/faisals-room", label: "Overview", icon: LayoutDashboard },
  { href: "/faisals-room/pages", label: "Pages", icon: FileText },
  { href: "/faisals-room/projects", label: "Projects", icon: FolderKanban },
  { href: "/faisals-room/media", label: "Media", icon: Image },
  { href: "/faisals-room/seo", label: "SEO foundation", icon: Search },
  { href: "/faisals-room/leads", label: "Leads", icon: Archive },
  { href: "/faisals-room/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/faisals-room/navigation", label: "Navigation", icon: SlidersHorizontal },
  { href: "/faisals-room/settings", label: "Settings", icon: Settings },
  { href: "/faisals-room/system", label: "System", icon: Activity },
];

export function RoomShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLogin = path.endsWith("/login");
  const active = navigation.find((item) => item.href === path)?.label ?? "Faisal’s Room";
  async function logout() {
    try { await fetch("/api/faisals-room/auth/logout", { method: "POST" }); } finally { router.replace("/faisals-room/login"); router.refresh(); }
  }
  if (isLogin) return <>{children}</>;
  return (
    <div className="room-app">
      <aside className={`room-sidebar ${drawerOpen ? "room-sidebar-open" : ""}`} id="room-navigation">
        <Link className="room-brand" href="/faisals-room" aria-label="Faisal’s Room overview"><span className="room-brand-mark">F</span><span><strong>Faisal’s Room</strong><small>Private control center</small></span></Link>
        <div className="room-nav-label">WORKSPACE</div>
        <nav className="room-nav" aria-label="Faisal’s Room navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const selected = path === href;
            return <Link key={href} href={href} className={`room-nav-link ${selected ? "room-nav-active" : ""}`} aria-current={selected ? "page" : undefined} onClick={() => setDrawerOpen(false)}><Icon aria-hidden="true" size={17} /><span>{label}</span>{selected ? <ChevronRight aria-hidden="true" size={15} /> : null}</Link>;
          })}
        </nav>
        <div className="room-sidebar-footer"><span className="room-status-dot" aria-hidden="true" /><span>Single-owner workspace</span></div>
      </aside>
      {drawerOpen ? <button className="room-drawer-backdrop" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} /> : null}
      <section className="room-workspace">
        <header className="room-topbar">
          <button className="room-mobile-toggle" type="button" aria-expanded={drawerOpen} aria-controls="room-navigation" aria-label={drawerOpen ? "Close navigation" : "Open navigation"} onClick={() => setDrawerOpen((value) => !value)}>{drawerOpen ? <X size={19} /> : <Menu size={19} />}</button>
          <div className="room-breadcrumb"><span>Faisal’s Room</span><ChevronRight aria-hidden="true" size={14} /><strong>{active}</strong></div>
          <div className="room-topbar-actions"><span className="room-owner-chip">Owner</span><button type="button" className="room-icon-button" aria-label="Sign out" onClick={logout}><LogOut size={17} /></button></div>
        </header>
        <main className="room-main">{children}</main>
      </section>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowUpRight, BarChart3, FileText, FolderKanban, Image, LockKeyhole, Search, Settings, SlidersHorizontal } from "lucide-react";
import { getOwnerSession } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { listContent } from "@/lib/server/content/repository";
import type { ContentRecord } from "@/lib/server/content/repository";
import { query } from "@/lib/server/db";
import { ContentManager } from "./components/ContentManager";
import { LeadInbox } from "./components/LeadInbox";
import { MediaLibrary } from "./components/MediaLibrary";
import { PasswordChange } from "./components/PasswordChange";

const moduleCards = [
  { href: "/faisals-room/pages", title: "Pages", description: "Manage safe page and section drafts.", icon: FileText },
  { href: "/faisals-room/projects", title: "Projects", description: "Edit verified project records and publish deliberately.", icon: FolderKanban },
  { href: "/faisals-room/media", title: "Media", description: "Private image storage, alt text, and usage metadata.", icon: Image },
  { href: "/faisals-room/seo", title: "SEO foundation", description: "Draft route metadata without analytics or audit claims.", icon: Search },
  { href: "/faisals-room/leads", title: "Leads", description: "Review durably stored contact submissions.", icon: FileText },
  { href: "/faisals-room/analytics", title: "Analytics", description: "Connection setup is deferred to Phase 2.", icon: BarChart3 },
  { href: "/faisals-room/navigation", title: "Navigation", description: "Draft public header and footer links.", icon: SlidersHorizontal },
  { href: "/faisals-room/settings", title: "Settings", description: "Site identity and owner account security.", icon: Settings },
  { href: "/faisals-room/system", title: "System", description: "Configuration readiness and foundation checks.", icon: Activity },
];

export async function Workspace({ active, title, description, kind }: { active: string; title: string; description: string; kind?: "pages" | "projects" | "settings" | "navigation" | "seo" | "leads" | "media" | "analytics" | "system" | "overview" }) {
  let owner;
  try { owner = await getOwnerSession(); } catch { redirect("/faisals-room/login"); }
  if (!owner) redirect("/faisals-room/login");
  const recordKind = kind && ["pages", "projects", "settings", "navigation", "seo"].includes(kind) ? kind as "pages" | "projects" | "settings" | "navigation" | "seo" : undefined;
  let records: ContentRecord[] = [];
  let dataError = "";
  if (recordKind) {
    try { records = await listContent(recordKind); }
    catch { dataError = "The content database could not be read. Check the configured database and migration state."; }
  }
  return <>
    <div className="room-page-heading"><div><p className="room-eyebrow">{active} / Faisal’s Room</p><h1>{title}</h1><p>{description}</p></div><span className="room-published-badge"><span aria-hidden="true" />Private workspace</span></div>
    {dataError ? <div className="room-alert room-alert-warning" role="status">{dataError}</div> : null}
    {recordKind ? <ContentManager kind={recordKind} initialRecords={records} /> : null}
    {kind === "leads" ? <LeadInbox /> : null}
    {kind === "media" ? <MediaLibrary /> : null}
    {kind === "analytics" ? <section className="room-card room-not-connected"><div className="room-card-icon"><BarChart3 size={20} /></div><p className="room-eyebrow">Phase 1 / not connected</p><h2>No analytics data is being shown</h2><p>GA4 and Search Console integrations, account ownership, consent decisions, and reporting are Phase 2. This workspace intentionally shows no placeholder metrics.</p><span className="room-status-pill">Not connected</span></section> : null}
    {kind === "settings" ? <PasswordChange /> : null}
    {kind === "system" ? <SystemReadiness /> : null}
    {kind === "overview" ? <Overview /> : null}
  </>;
}

async function Overview() {
  let counts: { publishedPages: number | null; drafts: number | null; leads: number | null } = { publishedPages: 0, drafts: 0, leads: 0 };
  try {
    const [pages, drafts, leads] = await Promise.all([
      query<{ count: string }>("SELECT count(*) AS count FROM pages WHERE status='published'"),
      query<{ count: string }>("SELECT (SELECT count(*) FROM pages WHERE status='draft') + (SELECT count(*) FROM projects WHERE status='draft') + (SELECT count(*) FROM navigation_items WHERE status='draft') AS count"),
      query<{ count: string }>("SELECT count(*) AS count FROM contact_submissions WHERE status <> 'archived'"),
    ]);
    counts = { publishedPages: Number(pages.rows[0]?.count ?? 0), drafts: Number(drafts.rows[0]?.count ?? 0), leads: Number(leads.rows[0]?.count ?? 0) };
  } catch { counts = { publishedPages: null, drafts: null, leads: null }; }
  return <>
    <section className="room-welcome-card"><div><p className="room-eyebrow">A quiet starting point</p><h2>Your work, content, and operating basics in one private place.</h2><p>The public site stays as it is until you explicitly review and publish a database-backed change.</p></div><Link className="room-button room-button-secondary" href="/">View public website <ArrowUpRight size={16} /></Link></section>
    <section className="room-metric-grid" aria-label="Current content counts"><article className="room-metric"><span>Published pages</span><strong>{counts.publishedPages ?? "—"}</strong><small>Database records</small></article><article className="room-metric"><span>Content drafts</span><strong>{counts.drafts ?? "—"}</strong><small>Pages, projects, and navigation</small></article><article className="room-metric"><span>Open leads</span><strong>{counts.leads ?? "—"}</strong><small>Stored contact submissions</small></article></section>
    <div className="room-section-heading"><div><p className="room-eyebrow">Your workspaces</p><h2>Choose where to continue</h2></div></div>
    <section className="room-module-grid">{moduleCards.map(({ href, title, description, icon: Icon }) => <Link className="room-module-card" key={href} href={href}><span className="room-module-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight aria-hidden="true" size={16} /></Link>)}</section>
  </>;
}

async function SystemReadiness() {
  let database = "Not configured"; let migration = "Unavailable";
  try {
    const config = getConfig();
    if (config.DATABASE_URL) {
      database = "Configured";
      const result = await query<{ count: string }>("SELECT count(*) AS count FROM schema_migrations");
      migration = `${result.rows[0]?.count ?? "0"} migration(s) applied`;
    }
  } catch { database = "Connection unavailable"; }
  const cfg = getConfig();
  const rows = [
    ["Database connection", database], ["Schema", migration], ["Public content read source", cfg.CONTENT_SOURCE],
    ["Private media storage path", "Configured (path withheld)"], ["Owner authentication", "Argon2id + opaque expiring sessions"],
    ["GA4 / Search Console", "Not connected — Phase 2"], ["Automated health audit / backups", "Deferred — Phase 3"],
  ];
  return <section className="room-card"><p className="room-eyebrow">Foundation readiness</p><h2>Configuration at a glance</h2><p>Values below are status-only; database URLs, passwords, and provider secrets are never displayed.</p><dl className="room-status-list">{rows.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="room-alert room-alert-info"><LockKeyhole size={16} /> Set configuration through the deployment secret store. Bootstrap owner credentials must be removed immediately after one-time setup.</div></section>;
}

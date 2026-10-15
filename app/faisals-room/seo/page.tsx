import Link from "next/link";
import { Workspace } from "../Workspace";
export default function SeoWorkspace() {
  return (
    <>
      <Workspace active="SEO foundation" title="SEO metadata foundation" description="Draft route title, description, canonical, and robots fields. Structured-data previews, search reporting, health findings, and redirects are Phase 2." kind="seo" />
      <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="Search Console">
        <h2 style={{ marginTop: 0 }}>Search Console</h2>
        <p className="room-editor-help">
          Connect Google Search Console to see real search performance — clicks, impressions,
          average CTR, average position, top queries, and top pages. Server-side only, read-only,
          independent from the GA4 connection.
        </p>
        <div className="room-editor-actions">
          <Link className="room-button room-button-primary" href="/faisals-room/seo/search-console">
            Open Search Console
          </Link>
        </div>
      </section>
    </>
  );
}

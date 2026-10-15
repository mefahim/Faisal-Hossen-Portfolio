import Link from "next/link";
import { Workspace } from "../Workspace";
export default function SystemWorkspace() {
  return (
    <>
      <Workspace active="System" title="System foundation" description="Review setup readiness without exposing database URLs, passwords, API keys, or provider tokens." kind="system" />
      <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="Website health audit">
        <h2 style={{ marginTop: 0 }}>Website health audit</h2>
        <p className="room-editor-help">
          On-demand technical audit: SEO basics, accessibility, security headers, and
          crawlability. Every finding is backed by evidence — no made-up scores.
        </p>
        <div className="room-editor-actions">
          <Link className="room-button room-button-primary" href="/faisals-room/system/health">
            Open health audit
          </Link>
        </div>
      </section>
    </>
  );
}

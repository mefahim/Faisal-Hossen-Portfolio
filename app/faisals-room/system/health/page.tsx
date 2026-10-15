import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/server/auth";
import { HealthAuditClient } from "./HealthAuditClient";

/**
 * Phase 2 — Website Health Audit Engine.
 *
 * On-demand, evidence-based website audits. Every finding carries its
 * category, severity, affected URL, evidence, recommended fix, method
 * (measured/heuristic), and timestamp. Nothing is fabricated.
 */
export default async function HealthAuditPage() {
  let owner;
  try {
    owner = await getOwnerSession();
  } catch {
    redirect("/faisals-room/login");
  }
  if (!owner) redirect("/faisals-room/login");

  const defaultTarget = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

  return (
    <>
      <div className="room-page-heading">
        <div>
          <p className="room-eyebrow">System / Faisal&apos;s Room</p>
          <h1>Website health audit</h1>
          <p>
            On-demand technical audit: SEO basics, accessibility, security headers,
            and crawlability — each finding backed by evidence, never a made-up score.
          </p>
        </div>
        <span className="room-published-badge"><span aria-hidden="true" />Private workspace</span>
      </div>
      <HealthAuditClient defaultTarget={defaultTarget} />
    </>
  );
}

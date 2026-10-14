import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/server/auth";
import { listRedirects } from "@/lib/server/content/redirects";
import { RedirectManagerClient } from "./RedirectManagerClient";

/**
 * Phase 2 Feature 2: Redirect Manager (planning-only).
 *
 * Redirect rules are drafts. They do not affect public traffic — no middleware
 * or public route handler evaluates the `redirects` table. Production
 * activation requires a separate approved release.
 */
export default async function RedirectManagerPage() {
  let owner;
  try {
    owner = await getOwnerSession();
  } catch {
    redirect("/faisals-room/login");
  }
  if (!owner) redirect("/faisals-room/login");

  let rules: Awaited<ReturnType<typeof listRedirects>> = [];
  let dataError = "";
  try {
    rules = await listRedirects();
  } catch {
    dataError = "Redirect rules could not be read. Check the database and migration state (0002_redirects.sql).";
  }

  return (
    <>
      <div className="room-page-heading">
        <div>
          <p className="room-eyebrow">Redirect manager / Faisal’s Room</p>
          <h1>Redirect rules (planning)</h1>
          <p>Draft, validate, preview, and audit redirect rules. Rules are stored as drafts and never affect public traffic in this phase.</p>
        </div>
        <span className="room-published-badge"><span aria-hidden="true" />Private workspace</span>
      </div>
      {dataError ? <div className="room-alert room-alert-warning" role="status">{dataError}</div> : null}
      <RedirectManagerClient initialRules={rules} />
    </>
  );
}

import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/server/auth";
import { LeadsInboxClient } from "./LeadsInbox";

/**
 * Phase 2 — Lead Inbox.
 *
 * Real inbox for stored contact submissions: search, status filter,
 * pagination, detail view, and owner-only status transitions.
 */
export default async function LeadsPage() {
  let owner;
  try {
    owner = await getOwnerSession();
  } catch {
    redirect("/faisals-room/login");
  }
  if (!owner) redirect("/faisals-room/login");

  return (
    <>
      <div className="room-page-heading">
        <div>
          <p className="room-eyebrow">Leads / Faisal&apos;s Room</p>
          <h1>Contact inbox</h1>
          <p>
            Every accepted message is stored before optional email delivery.
            Status and notification outcome remain separate.
          </p>
        </div>
        <span className="room-published-badge"><span aria-hidden="true" />Private workspace</span>
      </div>
      <LeadsInboxClient />
    </>
  );
}

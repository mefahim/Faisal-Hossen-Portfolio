"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Phase 2 — Lead Inbox client.
 *
 * List + detail views for stored contact submissions. Owner-only actions:
 * search, status filter, pagination, and status transitions. All lead data
 * comes from the owner-only API; nothing is fabricated.
 */

type LeadStatus = "new" | "reviewing" | "qualified" | "won" | "archived";

type Lead = {
  id: string;
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  status: LeadStatus;
  delivery_status: "pending" | "sent" | "failed" | "not_configured";
  created_at: string;
  updated_at: string;
};

type ListResponse = {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
};

const STATUSES: Array<{ key: LeadStatus | ""; label: string }> = [
  { key: "", label: "All statuses" },
  { key: "new", label: "New" },
  { key: "reviewing", label: "Reviewing" },
  { key: "qualified", label: "Qualified" },
  { key: "won", label: "Won" },
  { key: "archived", label: "Archived" },
];

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: "room-badge-info",
  reviewing: "room-badge-warning",
  qualified: "room-badge-success",
  won: "room-badge-success",
  archived: "room-badge-muted",
};

const DELIVERY_LABEL: Record<Lead["delivery_status"], string> = {
  pending: "Email pending",
  sent: "Email sent",
  failed: "Email failed",
  not_configured: "Email not configured",
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function LeadsInboxClient() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadLeads = useCallback(async (search: string, statusFilter: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/faisals-room/leads?${params.toString()}`);
      const json = (await response.json()) as ListResponse;
      if (!response.ok) throw new Error(json.error ?? "Could not load leads.");
      setData(json);
      // If the selected lead is no longer on this page, keep the detail open
      // only when it still exists in the result set.
      if (selectedId && !json.leads.some((l) => l.id === selectedId)) {
        // Leave detail open; the lead may be on another page/filter.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads.");
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLeads(q, status, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSelectedId(null);
    loadLeads(q, status, 1);
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setStatus(e.target.value);
    setPage(1);
    setSelectedId(null);
    loadLeads(q, e.target.value, 1);
  }

  async function handleStatusUpdate(leadId: string, newStatus: LeadStatus) {
    setUpdating(true);
    setActionError(null);
    try {
      const response = await fetch("/api/faisals-room/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      const json = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not update status.");
      await loadLeads(q, status, page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setUpdating(false);
    }
  }

  const selected = selectedId ? data?.leads.find((l) => l.id === selectedId) ?? null : null;

  return (
    <div>
      {/* Toolbar: search + status filter */}
      <section className="room-card" aria-label="Search and filter leads">
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <label htmlFor="lead-search" className="room-editor-help" style={{ position: "absolute", left: "-9999px" }}>
            Search leads
          </label>
          <input
            id="lead-search"
            type="search"
            className="room-input"
            placeholder="Search name, email, subject…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
          <select
            id="lead-status-filter"
            className="room-input"
            value={status}
            onChange={handleStatusChange}
            aria-label="Filter by status"
          >
            {STATUSES.map((s) => (
              <option key={s.key || "all"} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="room-button room-button-primary" disabled={loading}>
            Search
          </button>
        </form>
      </section>

      {actionError && (
        <div className="room-alert room-alert-error" role="alert" style={{ marginTop: "1rem" }}>
          {actionError}
        </div>
      )}

      {/* List */}
      <section className="room-card" style={{ marginTop: "1rem" }} aria-label="Leads">
        {loading ? (
          <div role="status" aria-label="Loading leads">
            <p className="room-editor-help">Loading leads…</p>
          </div>
        ) : error ? (
          <div className="room-alert room-alert-error" role="alert">
            <strong>Could not load leads.</strong> {error}{" "}
            <button type="button" className="room-button" onClick={() => loadLeads(q, status, page)}>
              Retry
            </button>
          </div>
        ) : !data || data.leads.length === 0 ? (
          <div role="status" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <p><strong>No leads found.</strong></p>
            <p className="room-editor-help">
              {q || status
                ? "Try a different search or status filter."
                : "New contact form submissions will appear here."}
            </p>
          </div>
        ) : (
          <>
            <p className="room-editor-help" role="status">
              {data.total} lead{data.total === 1 ? "" : "s"} · page {data.page} of {data.totalPages}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="room-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Name</th>
                    <th style={{ textAlign: "left" }}>Subject</th>
                    <th style={{ textAlign: "left" }}>Status</th>
                    <th style={{ textAlign: "left" }}>Email</th>
                    <th style={{ textAlign: "right" }}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedId(lead.id)}
                      style={{ cursor: "pointer" }}
                      className={selectedId === lead.id ? "room-table-row-selected" : undefined}
                    >
                      <td style={{ fontWeight: 600 }}>{lead.name}</td>
                      <td>{lead.subject}</td>
                      <td>
                        <span className={`room-badge ${STATUS_BADGE[lead.status]}`}>{lead.status}</span>
                      </td>
                      <td>
                        <span className="room-editor-help" style={{ margin: 0 }}>
                          {DELIVERY_LABEL[lead.delivery_status]}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatDateTime(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 && (
              <div className="room-editor-actions" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="room-button"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="room-editor-help" role="status">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  className="room-button"
                  disabled={data.page >= data.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Detail */}
      {selected && (
        <section className="room-card" style={{ marginTop: "1rem" }} aria-label="Lead details">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ margin: 0 }}>Lead details</h2>
            <button type="button" className="room-button" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
          <dl className="room-status-list" style={{ marginTop: "1rem" }}>
            <div><dt>Name</dt><dd>{selected.name}</dd></div>
            <div><dt>Email</dt><dd>{selected.email}</dd></div>
            {selected.company && <div><dt>Company</dt><dd>{selected.company}</dd></div>}
            <div><dt>Subject</dt><dd>{selected.subject}</dd></div>
            <div><dt>Received</dt><dd>{formatDateTime(selected.created_at)}</dd></div>
            <div><dt>Notification</dt><dd>{DELIVERY_LABEL[selected.delivery_status]}</dd></div>
          </dl>
          <h3>Message</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{selected.message}</p>
          <h3>Change status</h3>
          <div className="room-editor-actions" style={{ flexWrap: "wrap" }}>
            {(Object.keys(STATUS_BADGE) as LeadStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`room-button ${selected.status === s ? "room-button-primary" : ""}`}
                disabled={updating || selected.status === s}
                onClick={() => handleStatusUpdate(selected.id, s)}
                aria-pressed={selected.status === s}
              >
                {s === selected.status ? `✓ ${s}` : s}
              </button>
            ))}
          </div>
          {updating && <p className="room-editor-help" role="status">Updating…</p>}
        </section>
      )}
    </div>
  );
}

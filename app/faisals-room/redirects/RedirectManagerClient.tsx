"use client";

import { useCallback, useEffect, useState } from "react";

type RedirectRule = {
  id: string;
  source_path: string;
  target_url: string;
  status_code: number;
  is_active: boolean;
  updated_at: string;
};

type AuditEntry = {
  id: string;
  redirect_id: string | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

type PreviewResult = {
  would_redirect: boolean;
  target: string | null;
  status_code: number | null;
  chain: string[];
  planning_only: boolean;
};

const EMPTY_FORM = { source_path: "", target_url: "", status_code: 301 };

export function RedirectManagerClient({ initialRules }: { initialRules: RedirectRule[] }) {
  const [rules, setRules] = useState<RedirectRule[]>(initialRules);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "working" | "success" | "error"; message: string }>({ kind: "idle", message: "" });
  const [previewPath, setPreviewPath] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; rejected: { row: number; source_path: string; errors: string[] }[] } | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/faisals-room/redirects", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules ?? []);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/faisals-room/redirects/audit", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      setAudit(data.audit ?? []);
    }
    setShowAudit(true);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ kind: "working", message: "Saving…" });
    try {
      const res = await fetch("/api/faisals-room/redirects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status_code: Number(form.status_code) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setStatus({ kind: "success", message: data.message });
      setForm(EMPTY_FORM);
      setEditing(null);
      await refresh();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Save failed." });
    }
  };

  const handleDelete = async (source_path: string) => {
    if (!window.confirm(`Delete the redirect rule for ${source_path}?`)) return;
    setStatus({ kind: "working", message: "Deleting…" });
    try {
      const res = await fetch(`/api/faisals-room/redirects?source_path=${encodeURIComponent(source_path)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setStatus({ kind: "success", message: data.message });
      await refresh();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Delete failed." });
    }
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/faisals-room/redirects/preview?path=${encodeURIComponent(previewPath)}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed.");
      // Safety assertion: preview must never redirect the browser.
      if (res.status !== 200 || res.headers.get("location")) {
        throw new Error("Preview returned an unexpected redirect. Aborted.");
      }
      setPreview(data);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Preview failed." });
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ kind: "working", message: "Importing…" });
    setImportResult(null);
    try {
      const res = await fetch("/api/faisals-room/redirects/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setImportResult({ imported: data.imported, rejected: data.rejected });
      setStatus({ kind: "success", message: data.message });
      setCsvText("");
      await refresh();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Import failed." });
    }
  };

  const handleRevert = async (audit_id: string) => {
    if (!window.confirm("Revert this redirect to the recorded prior state?")) return;
    setStatus({ kind: "working", message: "Reverting…" });
    try {
      const res = await fetch("/api/faisals-room/redirects/revert", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revert failed.");
      setStatus({ kind: "success", message: data.message });
      await refresh();
      await loadAudit();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Revert failed." });
    }
  };

  const handleBulk = async (action: "bulk-disable" | "bulk-enable") => {
    const label = action === "bulk-disable" ? "disable all rules" : "re-enable previously active rules";
    if (!window.confirm(`Are you sure you want to ${label}? (Planning-only; no public traffic impact.)`)) return;
    setStatus({ kind: "working", message: "Working…" });
    try {
      const res = await fetch(`/api/faisals-room/redirects/${action}`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed.");
      setStatus({ kind: "success", message: data.message });
      await refresh();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Bulk action failed." });
    }
  };

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: key === "status_code" ? Number(e.target.value) : e.target.value }));

  useEffect(() => {
    if (editing) {
      const rule = rules.find((r) => r.source_path === editing);
      if (rule) setForm({ source_path: rule.source_path, target_url: rule.target_url, status_code: rule.status_code });
    }
  }, [editing, rules]);

  return (
    <div>
      <div className="room-alert room-alert-info" role="status" style={{ marginBottom: "1.5rem" }}>
        <strong>Planning only.</strong> Redirect rules are drafts. They do not affect public traffic — no middleware
        or public route evaluates these rules. Production activation requires a separate approved release.
        Rule states: <code>Draft</code> / <code>Validated</code> / <code>Ready</code>. Never <code>Active</code> in this phase.
      </div>

      {status.message ? (
        <div
          className={`room-alert ${status.kind === "error" ? "room-alert-warning" : "room-alert-info"}`}
          role={status.kind === "error" ? "alert" : "status"}
          style={{ marginBottom: "1rem" }}
        >
          {status.message}
        </div>
      ) : null}

      <div className="room-editor-layout">
        <section className="room-editor-card" aria-label="Redirect rules">
          <h2 style={{ marginTop: 0 }}>Rules ({rules.length})</h2>
          {rules.length === 0 ? (
            <p className="room-editor-help">No redirect rules yet. Create one below or import from CSV.</p>
          ) : (
            <div className="room-lead-list">
              {rules.map((r) => (
                <article key={r.id} className="room-lead-card">
                  <div className="room-lead-head">
                    <h3><code>{r.source_path}</code></h3>
                    <span className="room-status-pill">Draft</span>
                  </div>
                  <p className="room-lead-contact">
                    → <code>{r.target_url}</code> · {r.status_code}
                  </p>
                  <div className="room-lead-actions">
                    <button type="button" className="room-text-button" onClick={() => setEditing(r.source_path)}>Edit</button>
                    <button type="button" className="room-text-button" onClick={() => handleDelete(r.source_path)}>Delete</button>
                    <button type="button" className="room-text-button" onClick={() => { setPreviewPath(r.source_path); }}>Preview</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="room-editor-actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="room-button room-button-secondary" onClick={() => handleBulk("bulk-disable")}>Disable all</button>
            <button type="button" className="room-button room-button-secondary" onClick={() => handleBulk("bulk-enable")}>Re-enable</button>
            <button type="button" className="room-button room-button-secondary" onClick={loadAudit}>
              {showAudit ? "Hide audit history" : "Show audit history"}
            </button>
            <a className="room-button room-button-secondary" href="/api/faisals-room/redirects/export" download>Export CSV</a>
          </div>
        </section>

        <section className="room-editor-card" aria-label="Create or edit redirect">
          <h2 style={{ marginTop: 0 }}>{editing ? `Edit ${editing}` : "New redirect rule"}</h2>
          <form onSubmit={handleSave}>
            <label className="room-editor-label" htmlFor="rd-source">Source path</label>
            <input
              id="rd-source"
              className="room-json-editor"
              style={{ width: "100%", minHeight: "auto", marginBottom: "0.5rem" }}
              value={form.source_path}
              onChange={set("source_path")}
              placeholder="/old-page"
              disabled={editing !== null}
              aria-describedby="rd-source-help"
            />
            <p className="room-editor-help" id="rd-source-help">Root-relative path. Cannot use /faisals-room/* or /api/*.</p>

            <label className="room-editor-label" htmlFor="rd-target">Target URL</label>
            <input
              id="rd-target"
              className="room-json-editor"
              style={{ width: "100%", minHeight: "auto", marginBottom: "0.5rem" }}
              value={form.target_url}
              onChange={set("target_url")}
              placeholder="/new-page or https://…"
              inputMode="url"
            />
            <p className="room-editor-help">Root-relative path or absolute https:// URL.</p>

            <label className="room-editor-label" htmlFor="rd-status">Status code</label>
            <select
              id="rd-status"
              className="room-json-editor"
              style={{ width: "100%", minHeight: "auto", marginBottom: "1rem" }}
              value={form.status_code}
              onChange={set("status_code")}
            >
              <option value={301}>301 — Moved Permanently</option>
              <option value={302}>302 — Found</option>
              <option value={307}>307 — Temporary Redirect</option>
              <option value={308}>308 — Permanent Redirect</option>
            </select>

            <div className="room-editor-actions">
              <button type="submit" className="room-button room-button-primary" disabled={status.kind === "working"}>
                {status.kind === "working" ? "Saving…" : editing ? "Update rule" : "Create rule"}
              </button>
              {editing ? (
                <button type="button" className="room-button room-button-secondary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <h3 style={{ marginTop: "1.5rem" }}>Preview simulation</h3>
          <form onSubmit={handlePreview}>
            <label className="room-editor-label" htmlFor="rd-preview-path">Path to simulate</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="rd-preview-path"
                className="room-json-editor"
                style={{ flex: 1, minWidth: 0, minHeight: "auto" }}
                value={previewPath}
                onChange={(e) => setPreviewPath(e.target.value)}
                placeholder="/old-page"
              />
              <button type="submit" className="room-button room-button-secondary">Simulate</button>
            </div>
          </form>
          {preview ? (
            <div className="room-preview-details" role="status">
              <p><strong>Simulation only — no redirect performed.</strong></p>
              <p>Would redirect: {preview.would_redirect ? "yes" : "no"}</p>
              {preview.would_redirect ? (
                <p>Target: <code>{preview.target}</code> ({preview.status_code})</p>
              ) : null}
              <p>Chain: <code>{preview.chain.join(" → ")}</code></p>
            </div>
          ) : null}

          <h3 style={{ marginTop: "1.5rem" }}>CSV import</h3>
          <form onSubmit={handleImport}>
            <label className="room-editor-label" htmlFor="rd-csv">Paste CSV (header: source_path,target_url,status_code,is_active)</label>
            <textarea
              id="rd-csv"
              className="room-json-editor"
              style={{ width: "100%", minHeight: "8rem" }}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"source_path,target_url,status_code,is_active\n/old,/new,301,false"}
            />
            <div className="room-editor-actions">
              <button type="submit" className="room-button room-button-secondary" disabled={status.kind === "working" || !csvText.trim()}>
                Import CSV
              </button>
            </div>
          </form>
          {importResult ? (
            <div className="room-preview-details" role="status">
              <p>Imported: {importResult.imported}</p>
              {importResult.rejected.length > 0 ? (
                <>
                  <p>Rejected rows:</p>
                  <ul>
                    {importResult.rejected.map((r) => (
                      <li key={r.row}>Row {r.row} ({r.source_path}): {r.errors.join("; ")}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {showAudit ? (
        <section className="room-card" style={{ marginTop: "1.5rem" }} aria-label="Audit history">
          <h2>Audit history</h2>
          {audit.length === 0 ? (
            <p className="room-editor-help">No audit entries yet.</p>
          ) : (
            <div>
              {audit.map((a) => (
                <div key={a.id} className="room-revision-row">
                  <span>
                    <strong>{a.action}</strong>
                    <small>{a.redirect_id ?? "bulk action"} · {new Date(a.created_at).toLocaleString()}</small>
                  </span>
                  {a.old_value ? (
                    <button type="button" className="room-text-button" onClick={() => handleRevert(a.id)}>
                      Revert to prior state
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

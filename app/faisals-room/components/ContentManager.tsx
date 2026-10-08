"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, History, Save, Send, ShieldCheck } from "lucide-react";
import type { ContentRecord } from "@/lib/server/content/repository";
import type { ContentKind } from "@/lib/server/validation";

export function ContentManager({ kind, initialRecords }: { kind: ContentKind; initialRecords: ContentRecord[] }) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [selectedKey, setSelectedKey] = useState(initialRecords[0]?.key ?? "");
  const selected = records.find((record) => record.key === selectedKey) ?? records[0];
  const [text, setText] = useState(selected ? JSON.stringify(selected.draft, null, 2) : "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revisions, setRevisions] = useState<{id:string;publish_state:string;created_at:string;restores_revision_id:string|null}[]>([]);
  const [preview, setPreview] = useState("");
  const dirty = useMemo(() => Boolean(selected && text !== JSON.stringify(selected.draft, null, 2)), [selected, text]);

  useEffect(() => { if (selected) setText(JSON.stringify(selected.draft, null, 2)); setPreview(""); setMessage(""); }, [selectedKey]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!selected) return;
    fetch(`/api/faisals-room/revisions?kind=${kind}&key=${encodeURIComponent(selected.key)}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => setRevisions(data?.revisions ?? [])).catch(() => setRevisions([]));
  }, [kind, selectedKey, selected?.updatedAt]);

  async function callApi(url: string, payload: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    const result = await response.json() as { message?: string; error?: string };
    if (response.status === 401) { router.replace("/faisals-room/login"); router.refresh(); }
    if (!response.ok) throw new Error(result.error ?? "The request failed.");
    return result.message ?? "Done.";
  }
  async function save() {
    if (!selected) return;
    let draft: unknown;
    try { draft = JSON.parse(text); } catch { setMessage("This is not valid JSON. Fix the syntax before saving."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await callApi("/api/faisals-room/content", { kind, key: selected.key, draft });
      setRecords((current) => current.map((record) => record.key === selected.key ? { ...record, draft: draft as Record<string, unknown>, updatedAt: new Date().toISOString() } : record));
      setMessage(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!selected) return;
    if (dirty) { setMessage("Save the current draft before publishing."); return; }
    if (!window.confirm(`Publish “${selected.title}” to the public website? This will create a new revision.`)) return;
    setBusy(true); setMessage("");
    try { setMessage(await callApi("/api/faisals-room/publish", { kind, key: selected.key })); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Publish failed."); }
    finally { setBusy(false); }
  }
  async function inspectPreview() {
    if (!selected) return;
    try {
      const response = await fetch(`/api/faisals-room/preview?kind=${kind}&key=${encodeURIComponent(selected.key)}`, { cache: "no-store" });
      const result = await response.json() as { draft?: unknown; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Preview unavailable.");
      setPreview(JSON.stringify(result.draft, null, 2));
      setMessage("Protected draft preview loaded. It is not visible to public visitors.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview unavailable."); }
  }
  function openRenderedPreview() {
    if (!selected) return;
    if (dirty) { setMessage("Save your draft before opening its rendered preview."); return; }
    window.open(`/faisals-room/preview?kind=${kind}&key=${encodeURIComponent(selected.key)}`, "_blank", "noopener,noreferrer");
  }
  async function restore(id: string) {
    if (!window.confirm("Restore this revision as a new draft? The public version will not change until you publish.")) return;
    setBusy(true);
    try { setMessage(await callApi("/api/faisals-room/restore", { revisionId: id })); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Restore failed."); }
    finally { setBusy(false); }
  }

  if (!records.length) return <section className="room-card room-empty-state"><p className="room-eyebrow">No database records yet</p><h2>Seed the verified content before editing.</h2><p>Run the documented migration and seed commands. The public site continues to use its checked-in source while the database is being prepared.</p></section>;
  return <div className="room-editor-layout">
    <aside className="room-record-list"><p className="room-eyebrow">Records</p>{records.map((record) => <button key={record.key} type="button" onClick={() => { if (dirty && !window.confirm("Discard unsaved changes and open another record?")) return; setSelectedKey(record.key); }} className={`room-record-button ${record.key === selected?.key ? "room-record-selected" : ""}`}><span>{record.title || record.key}</span><small>{record.status}{record.published ? " · published version exists" : " · draft only"}</small></button>)}</aside>
    <section className="room-editor-card">
      <div className="room-editor-toolbar"><div><p className="room-eyebrow">{kind} / {selected?.key}</p><h2>{selected?.title}</h2></div><span className={`room-status-pill ${selected?.status === "published" ? "room-status-published" : ""}`}>{selected?.status ?? "draft"}</span></div>
      <div className="room-editor-notice"><ShieldCheck size={16} /><span>Drafts stay private. Publish is a separate owner-only action; previous snapshots are kept.</span></div>
      <label htmlFor="room-content-json" className="room-editor-label">Structured content JSON</label>
      <textarea id="room-content-json" className="room-json-editor" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} aria-describedby="room-json-help" />
      <p id="room-json-help" className="room-editor-help">Server validation enforces content shape, size limits, safe local media paths, and internal navigation paths.</p>
      <div className="room-editor-actions"><button className="room-button room-button-secondary" type="button" disabled={busy || !dirty} onClick={save}><Save size={16} /> Save draft</button><button className="room-button room-button-secondary" type="button" disabled={busy} onClick={inspectPreview}><Eye size={16} /> Inspect payload</button><button className="room-button room-button-secondary" type="button" disabled={busy || dirty} onClick={openRenderedPreview}><Eye size={16} /> Open protected preview</button><button className="room-button room-button-primary" type="button" disabled={busy || dirty} onClick={publish}><Send size={16} /> Publish</button></div>
      <p className="room-editor-message" role="status" aria-live="polite">{dirty ? "Unsaved changes — save before leaving." : message}</p>
      {preview ? <details className="room-preview-details" open><summary>Protected draft preview data</summary><pre>{preview}</pre></details> : null}
      <section className="room-revision-section"><div className="room-section-heading"><div><p className="room-eyebrow">History</p><h3><History size={17} /> Immutable snapshots</h3></div></div>{revisions.length ? revisions.slice(0,10).map((revision) => <div className="room-revision-row" key={revision.id}><span><strong>{revision.publish_state}</strong><small>{new Date(revision.created_at).toLocaleString()}</small></span><button type="button" className="room-text-button" disabled={busy} onClick={() => restore(revision.id)}>Restore as draft</button></div>) : <p className="room-muted">No revisions yet. Saving or publishing creates a snapshot.</p>}</section>
    </section>
  </div>;
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ImagePlus, RefreshCw, Save, Upload } from "lucide-react";

type MediaItem = {
  id: string; storage_key: string; mime_type: string; byte_size: number; width: number; height: number;
  checksum_sha256: string; alt_text: string; focal_x: number | string; focal_y: number | string;
  derivatives: Record<string, string | boolean>; processing_state: string; archived_at: string | null;
  created_at: string; usage_count: number;
};

type MediaCardProps = {
  item: MediaItem;
  source: string;
  onArchive: (item: MediaItem) => void;
  onMetadataSaved: (id: string, values: { alt_text: string; focal_x: number; focal_y: number }) => void;
  onMessage: (message: string) => void;
};

function MediaCard({ item, source, onArchive, onMetadataSaved, onMessage }: MediaCardProps) {
  const [editing, setEditing] = useState(false);
  const [alt, setAlt] = useState(item.alt_text);
  const [focalX, setFocalX] = useState(String(item.focal_x));
  const [focalY, setFocalY] = useState(String(item.focal_y));
  const [saving, setSaving] = useState(false);
  const legacy = item.derivatives.legacyPublicAsset === true;
  useEffect(() => { setAlt(item.alt_text); setFocalX(String(item.focal_x)); setFocalY(String(item.focal_y)); }, [item.alt_text,item.focal_x,item.focal_y]);

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch(`/api/faisals-room/media/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: alt, focalX: Number(focalX), focalY: Number(focalY) }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Image metadata could not be updated.");
      onMetadataSaved(item.id,{alt_text:alt.trim(),focal_x:Number(focalX),focal_y:Number(focalY)});
      onMessage(result.message ?? "Image metadata updated."); setEditing(false);
    } catch (error) { onMessage(error instanceof Error ? error.message : "Image metadata could not be updated."); }
    finally { setSaving(false); }
  }

  return <article className={`room-media-card ${item.archived_at ? "room-media-archived" : ""}`}>
    <div className="room-media-image"><img src={source} alt={item.alt_text} loading="lazy" /></div>
    <div className="room-media-content">
      <p className="room-media-alt">{item.alt_text}</p>
      <div className="room-media-meta"><span>{item.width} × {item.height}</span><span>{(Number(item.byte_size) / 1024 / 1024).toFixed(2)} MB</span><span>{item.usage_count} use{item.usage_count === 1 ? "" : "s"}</span></div>
      <code>{item.checksum_sha256.slice(0,16)}…</code>
      {editing ? <form className="room-media-metadata-form" onSubmit={saveMetadata}>
        <label htmlFor={`media-alt-${item.id}`}>Alt text</label><input id={`media-alt-${item.id}`} value={alt} minLength={3} maxLength={500} required onChange={(event) => setAlt(event.target.value)} />
        <div className="room-focal-fields"><label htmlFor={`media-x-${item.id}`}>Focal X<input id={`media-x-${item.id}`} type="number" min="0" max="1" step="0.01" value={focalX} onChange={(event) => setFocalX(event.target.value)} /></label><label htmlFor={`media-y-${item.id}`}>Focal Y<input id={`media-y-${item.id}`} type="number" min="0" max="1" step="0.01" value={focalY} onChange={(event) => setFocalY(event.target.value)} /></label></div>
        <div className="room-media-footer"><button className="room-button room-button-secondary" type="submit" disabled={saving}><Save size={14} /> Save metadata</button><button className="room-text-button" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </form> : null}
      <div className="room-media-footer"><span className={`room-status-pill ${item.archived_at ? "" : "room-status-published"}`}>{item.archived_at ? "archived" : item.processing_state}</span>{!item.archived_at ? <div className="room-media-actions"><button className="room-text-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit metadata"}</button>{legacy ? <span className="room-media-legacy">Legacy public</span> : <button className="room-text-button" type="button" onClick={() => void navigator.clipboard.writeText(`media:${item.id}`).then(() => onMessage("Private media reference copied. Paste it into a project draft image field; it becomes public only when that project is published.")).catch(() => onMessage(`Project image reference: media:${item.id}`))}>Copy project ref</button>}<button className="room-text-button" type="button" disabled={item.usage_count > 0} title={item.usage_count ? "Remove project references before archiving" : "Archive image"} onClick={() => onArchive(item)}><Archive size={14} /> Archive</button></div> : null}</div>
    </div>
  </article>;
}

export function MediaLibrary() {
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [filter, setFilter] = useState("");
  const visibleItems = useMemo(() => items.filter((item) => `${item.alt_text} ${item.id} ${item.mime_type}`.toLowerCase().includes(filter.toLowerCase().trim())), [items,filter]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/faisals-room/media", { cache: "no-store" });
      if (response.status === 401) { router.replace("/faisals-room/login"); return; }
      const data = await response.json() as { media?: MediaItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Media library could not be loaded.");
      setItems(data.media ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Media library could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) { setMessage("Choose an image to upload."); return; }
    if (!altText.trim()) { setMessage("Descriptive alt text is required."); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage("Image must be 10 MB or smaller."); return; }
    const form = new FormData(); form.set("file",file); form.set("altText",altText); form.set("focalX","0.5"); form.set("focalY","0.5");
    setBusy(true); setMessage("Validating and processing image…");
    try {
      const response = await fetch("/api/faisals-room/media",{method:"POST",body:form});
      const result = await response.json() as {message?:string;error?:string};
      if (response.status === 401) { router.replace("/faisals-room/login"); return; }
      if (!response.ok) throw new Error(result.error ?? "Image upload failed.");
      setMessage(result.message ?? "Image uploaded."); setFile(null); setAltText(""); formElement.reset(); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image upload failed."); }
    finally { setBusy(false); }
  }

  async function archive(item: MediaItem) {
    if (item.usage_count) return;
    if (!window.confirm("Archive this image? Stored files will be retained.")) return;
    const response = await fetch(`/api/faisals-room/media/${item.id}`,{method:"DELETE"});
    const result = await response.json() as {message?:string;error?:string}; setMessage(result.message ?? result.error ?? "Archive request finished.");
    if (response.ok) await load();
  }
  function source(item: MediaItem) { return typeof item.derivatives.original === "string" ? item.derivatives.original : `/api/faisals-room/media/${item.id}?variant=thumbnail`; }
  function updateMetadata(id: string, values: {alt_text:string;focal_x:number;focal_y:number}) { setItems((current)=>current.map((item)=>item.id===id?{...item,...values}:item)); }

  return <div className="room-media-workspace">
    <section className="room-card room-upload-card"><div className="room-card-heading"><div><p className="room-eyebrow">Private storage / approved images only</p><h2>Add an image</h2><p>JPEG, PNG, WebP, or AVIF · maximum 10 MB · SVG and arbitrary files are rejected.</p></div><ImagePlus size={22}/></div>
      <form className="room-upload-form" onSubmit={upload}><label htmlFor="media-file">Image file</label><input id="media-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required onChange={(event)=>setFile(event.target.files?.[0]??null)}/><label htmlFor="media-alt">Descriptive alt text</label><input id="media-alt" type="text" value={altText} maxLength={500} required onChange={(event)=>setAltText(event.target.value)} placeholder="Describe what the image shows"/><button className="room-button room-button-primary" type="submit" disabled={busy}><Upload size={16}/>{busy?"Processing…":"Upload image"}</button></form>
      <p className="room-editor-message" role="status" aria-live="polite">{message}</p>
    </section>
    <section className="room-media-list-section"><div className="room-card-heading"><div><p className="room-eyebrow">Asset library</p><h2>Images and usage</h2></div><button type="button" className="room-button room-button-secondary" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
      <label className="room-media-filter-label" htmlFor="media-filter">Find image</label><input id="media-filter" className="room-media-filter" type="search" placeholder="Search alt text, ID, or image format" value={filter} onChange={(event)=>setFilter(event.target.value)} />
      {loading?<p className="room-muted">Loading media metadata…</p>:!visibleItems.length?<div className="room-empty-inline"><ImagePlus size={19}/><span>{items.length?"No media matches this filter.":"No image metadata yet. Existing public project images appear after running the content seed."}</span></div>:<div className="room-media-grid">{visibleItems.map((item)=><MediaCard key={item.id} item={item} source={source(item)} onArchive={(media)=>void archive(media)} onMetadataSaved={updateMetadata} onMessage={setMessage}/>)}</div>}
    </section>
  </div>;
}

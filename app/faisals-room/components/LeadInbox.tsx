"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";

type Lead = { id:string; name:string; email:string; company:string; subject:string; message:string; status:string; delivery_status:string; created_at:string; updated_at:string };
const statuses = ["new", "reviewing", "qualified", "won", "archived"];
export function LeadInbox() {
  const router = useRouter(); const [leads,setLeads] = useState<Lead[]>([]); const [error,setError] = useState(""); const [loading,setLoading] = useState(true);
  async function load() { setLoading(true); setError(""); try { const response=await fetch("/api/faisals-room/leads",{cache:"no-store"}); if(response.status===401){router.replace("/faisals-room/login");return;} const data=await response.json() as {leads?:Lead[];error?:string}; if(!response.ok) throw new Error(data.error??"Unable to load leads."); setLeads(data.leads??[]); } catch(e){setError(e instanceof Error?e.message:"Unable to load leads.");} finally{setLoading(false);} }
  useEffect(()=>{void load();},[]);
  async function setStatus(lead:Lead,status:string) { const res=await fetch("/api/faisals-room/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:lead.id,status})}); const data=await res.json() as {error?:string}; if(!res.ok){setError(data.error??"Status update failed.");return;} setLeads((current)=>current.map((item)=>item.id===lead.id?{...item,status}:item)); }
  return <section className="room-card room-leads-card"><div className="room-card-heading"><div><p className="room-eyebrow">Contact / inbox</p><h2>Messages, stored before notification.</h2></div><button type="button" className="room-button room-button-secondary" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
    <p className="room-muted">Email delivery is shown separately from durable storage. Only owner-authorized access can read these personal submissions.</p>
    {error?<div className="room-alert room-alert-warning" role="status">{error}</div>:null}{loading?<p className="room-muted">Loading stored submissions…</p>:!leads.length?<div className="room-empty-inline"><Mail size={19}/><span>No contact submissions have been stored yet.</span></div>:<div className="room-lead-list">{leads.map((lead)=><article className="room-lead-card" key={lead.id}><div className="room-lead-head"><div><p className="room-eyebrow">{new Date(lead.created_at).toLocaleString()}</p><h3>{lead.subject}</h3></div><span className={`room-status-pill room-delivery-${lead.delivery_status}`}>{lead.delivery_status.replaceAll("_"," ")}</span></div><div className="room-lead-contact"><strong>{lead.name}</strong><a href={`mailto:${encodeURIComponent(lead.email)}`}>{lead.email}</a>{lead.company?<span>{lead.company}</span>:null}</div><p className="room-lead-message">{lead.message}</p><div className="room-lead-actions"><label htmlFor={`lead-status-${lead.id}`}>Status</label><select id={`lead-status-${lead.id}`} value={lead.status} onChange={(event)=>void setStatus(lead,event.target.value)}>{statuses.map((status)=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></div></article>)}</div>}
  </section>;
}

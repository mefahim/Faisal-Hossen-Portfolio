import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/server/auth";
import { getDraft } from "@/lib/server/content/repository";
import { contentKindSchema } from "@/lib/server/validation";

type Props={searchParams:Promise<{kind?:string;key?:string}>};
export const metadata={title:"Private draft preview — Faisal’s Room",robots:{index:false,follow:false}};
export default async function DraftPreview({searchParams}:Props){
 let owner=null;try{owner=await getOwnerSession();}catch{redirect("/faisals-room/login");}if(!owner)redirect("/faisals-room/login");
 const params=await searchParams;const kind=contentKindSchema.safeParse(params.kind);const key=params.key??"";if(!kind.success||!key) return <section className="room-card"><h1>Preview unavailable</h1><p>Select a valid content draft in the editor.</p></section>;
 const data=await getDraft(kind.data,key);if(!data)return <section className="room-card"><h1>Draft not found</h1><p>This preview is private and is not published.</p></section>;
 const title=typeof data.title==="string"?data.title:typeof data.slug==="string"?data.slug:kind.data;
 const sections=Array.isArray(data.sections)?data.sections as {key?:string;type?:string;content?:Record<string,unknown>}[]:[];
 return <article className="room-preview-page"><p className="room-eyebrow">Protected preview / unpublished</p><h1>{title}</h1><p className="room-preview-warning">Only an authenticated owner can view this draft. Public visitors continue to receive published content or the verified file-backed fallback.</p><hr/>{kind.data==="projects"? <><h2>{String(data.summary??"")}</h2><p>{String(data.challenge??"")}</p><h3>{String(data.solutionLabel??"What changed")}</h3><ul>{Array.isArray(data.solutions)?data.solutions.map((item,i)=><li key={i}>{String(item)}</li>):null}</ul></>:kind.data==="pages"?sections.sort((a,b)=>Number((a.content?.position as number)??0)-Number((b.content?.position as number)??0)).map((section,index)=><section className="room-preview-section" key={section.key??index}><p className="room-eyebrow">{section.type??"section"}</p><h2>{String(section.content?.heading??section.content?.title??section.key??"Section")}</h2>{Object.entries(section.content??{}).filter(([name,value])=>!name.toLowerCase().includes("slug")&&typeof value==="string"&&name!=="heading"&&name!=="title").map(([name,value])=><p key={name}>{String(value)}</p>)}</section>):<pre>{JSON.stringify(data,null,2)}</pre>}<p className="room-preview-warning">Preview only — no public content has changed.</p></article>;
}

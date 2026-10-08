import "server-only";
import { z } from "zod";
import { requireOwner, UnauthorizedError } from "../auth";
import { transaction, query } from "../db";
import { contentDraftSchema, type ContentKind } from "../validation";
import type { Project } from "@/content/projects";

export const projectSchema: z.ZodType<Project> = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/), number: z.string().max(10), title: z.string().min(1).max(180),
  type: z.string().max(200), category: z.string().max(200), summary: z.string().max(3000), role: z.string().max(500),
  focus: z.array(z.string().max(100)).max(20), challengeLabel: z.string().max(100), challenge: z.string().max(5000),
  solutionLabel: z.string().max(100), solutions: z.array(z.string().max(1000)).max(40), approachLabel: z.string().max(100),
  approach: z.string().max(5000), experienceChange: z.string().max(3000), technology: z.array(z.string().max(100)).max(30),
  image: z.string().refine((value) => (/^\/assets\/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp|avif)$/.test(value) && !value.includes("..")) || /^media:[0-9a-f-]{36}$/i.test(value)), imageAlt: z.string().min(3).max(500),
  externalUrl: z.string().url().refine((url) => url.startsWith("https://"), "External links must use HTTPS.").optional(),
  externalLabel: z.string().max(150).optional(),
});
const navigationSchema = z.object({
  location: z.enum(["header", "footer"]), label: z.string().trim().min(1).max(80), href: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).refine((value) => !/^\/(?:admin|api|faisals-room)(?:\/|$)/i.test(value)),
  position: z.number().int().min(0).max(100), visible: z.boolean(),
});
export const seoSchema = z.object({ title: z.string().max(180), description: z.string().max(320), canonical: z.string().url().refine((url) => url.startsWith("https://")).optional(),
  robots: z.enum(["index,follow", "noindex,nofollow", "noindex,follow", "index,nofollow"]).default("index,follow"),
  ogTitle: z.string().max(180).optional(), ogDescription: z.string().max(320).optional(), ogImage: z.string().refine((value) => value.startsWith("https://") || (/^\/assets\/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp|avif)$/.test(value) && !value.includes(".."))).optional(),
});
export const pageSchema = z.object({
  key: z.string().regex(/^[a-z0-9/_-]{1,100}$/), route: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).refine((value) => !/^\/(?:admin|api|faisals-room)(?:\/|$)/i.test(value)), title: z.string().min(1).max(180),
  sections: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]{1,80}$/), type: z.string().regex(/^[a-z0-9_-]{1,80}$/), position: z.number().int().min(0).max(1000), content: z.record(z.string(), z.unknown()) })).max(80),
});
export const settingsSchema = z.object({
  site: z.object({ name: z.string().min(1).max(120), label: z.string().max(120), positioning: z.string().max(500), supporting: z.string().max(2000), context: z.string().max(200), capabilities: z.array(z.string().max(100)).max(30) }),
  contactDetails: z.object({ phone: z.string().max(80), phoneHref: z.string().regex(/^tel:\+?[0-9(). -]{7,40}$/), socialLinks: z.array(z.object({ label: z.string().max(50), href: z.string().url().refine((url) => url.startsWith("https://")) })).max(20) }),
  problemStates: z.array(z.object({ id: z.string().max(80), label: z.string().max(120), shortLabel: z.string().max(80), diagnosis: z.string().max(1000), recommendation: z.string().max(1000), nextStep: z.string().max(1000) })).max(30),
  thinkingPrinciples: z.array(z.object({ index: z.string().max(10), title: z.string().max(180), body: z.string().max(1000) })).max(30),
  capabilities: z.array(z.object({ name: z.string().max(100), detail: z.string().max(1000), mark: z.string().max(10) })).max(30),
});

function validateDraft(kind: ContentKind, key: string, value: Record<string, unknown>) {
  const common = contentDraftSchema.safeParse({ kind, key, draft: value });
  if (!common.success) throw new Error("Draft content is invalid or too large.");
  const schema = kind === "settings" ? settingsSchema : kind === "projects" ? projectSchema : kind === "navigation" ? navigationSchema : kind === "seo" ? seoSchema : pageSchema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Draft validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 5).join(", ")}`);
  if (kind === "projects" && (parsed.data as Project).slug !== key) throw new Error("Project slug cannot be changed through the draft editor.");
  if (kind === "pages" && (parsed.data as z.infer<typeof pageSchema>).key !== key) throw new Error("Page key cannot be changed through the draft editor.");
  if (kind === "pages") {
    const page = parsed.data as z.infer<typeof pageSchema>;
    const expectedRoute = key === "home" ? "/" : key.startsWith("work/") ? `/work/${key.slice("work/".length)}` : `/${key}`;
    if (page.route !== expectedRoute) throw new Error("Page routes are fixed to their verified public paths.");
  }
  if (kind === "navigation" && !/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Navigation item key is invalid.");
  if (kind === "seo" && "route" in value) throw new Error("SEO draft does not accept an editable route field.");
  if (kind === "seo" && !/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(key)) throw new Error("SEO route is invalid.");
  if (kind === "seo" && /^\/(?:admin|api|faisals-room)(?:\/|$)/i.test(key)) throw new Error("SEO records cannot target private or API routes.");
  return parsed.data as Record<string, unknown>;
}

export type ContentRecord = { key: string; title: string; status: string; draft: Record<string, unknown>; published: Record<string, unknown> | null; updatedAt: string };

async function assertActorIsOwner(actorId: string) {
  const owner = await requireOwner();
  if (owner.userId !== actorId) throw new UnauthorizedError();
}

export async function listContent(kind: ContentKind): Promise<ContentRecord[]> {
  if (kind === "settings") {
    const row = (await query<{ draft: Record<string, unknown>; published: Record<string, unknown> | null; status: string; draft_updated_at: Date }>("SELECT draft,published,status,draft_updated_at FROM site_settings WHERE id='default'")).rows[0];
    return row ? [{ key: "default", title: "Site settings", status: row.status, draft: row.draft, published: row.published, updatedAt: row.draft_updated_at.toISOString() }] : [];
  }
  const table = kind === "pages" ? "pages" : kind === "projects" ? "projects" : kind === "navigation" ? "navigation_items" : "seo_metadata";
  const keyColumn = kind === "pages" ? "key" : kind === "projects" ? "slug" : kind === "navigation" ? "id" : "route";
  const titleColumn = kind === "pages" ? "title" : kind === "projects" ? "slug" : kind === "navigation" ? "label" : "route";
  const rows = (await query<{ key: string; title: string; status: string; draft: Record<string, unknown>; published: Record<string, unknown> | null; updated_at: Date }>(`SELECT ${keyColumn}::text AS key, ${titleColumn} AS title, status, draft, published, updated_at FROM ${table} ORDER BY updated_at DESC`)).rows;
  return rows.map((row) => ({ key: row.key, title: row.title, status: row.status, draft: row.draft, published: row.published, updatedAt: row.updated_at.toISOString() }));
}

export async function saveDraft(kind: ContentKind, key: string, input: Record<string, unknown>, actorId: string, requestId: string) {
  await assertActorIsOwner(actorId);
  const draft = validateDraft(kind, key, input);
  await transaction(async (client) => {
    const target = kind === "settings" ? { table: "site_settings", where: "id='default'", values: [JSON.stringify(draft)] as unknown[] } :
      kind === "pages" ? { table: "pages", where: "key=$2", values: [JSON.stringify(draft), key] } :
      kind === "projects" ? { table: "projects", where: "slug=$2", values: [JSON.stringify(draft), key] } :
      kind === "navigation" ? { table: "navigation_items", where: "id=$2", values: [JSON.stringify(draft), key] } :
      { table: "seo_metadata", where: "route=$2", values: [JSON.stringify(draft), key] };
    const sql = kind === "settings" ? "UPDATE site_settings SET draft=$1::jsonb,draft_updated_at=now(),status=CASE WHEN published IS NULL THEN 'draft' ELSE status END WHERE id='default'" :
      `UPDATE ${target.table} SET draft=$1::jsonb,updated_at=now(),status=CASE WHEN published IS NULL THEN 'draft' ELSE status END WHERE ${target.where}`;
    const result = await client.query(sql, target.values);
    if (!result.rowCount) throw new Error("Content record was not found.");
    const entityId = kind === "settings" ? "default" : key;
    if (kind === "pages") {
      const page = draft as z.infer<typeof pageSchema>;
      const pageId = (await client.query<{ id: string }>("SELECT id FROM pages WHERE key=$1", [key])).rows[0]?.id;
      if (!pageId) throw new Error("Page record was not found.");
      for (const section of page.sections) await client.query(
        `INSERT INTO page_sections(page_id,section_key,section_type,position,status,draft)
         VALUES($1,$2,$3,$4,'draft',$5::jsonb)
         ON CONFLICT(page_id,section_key) DO UPDATE SET section_type=EXCLUDED.section_type,position=EXCLUDED.position,draft=EXCLUDED.draft,status='draft'`,
        [pageId, section.key, section.type, section.position, JSON.stringify(section.content)],
      );
    }
    await client.query("INSERT INTO revisions(entity_type,entity_id,snapshot,author_id,publish_state) VALUES($1,$2,$3::jsonb,$4,'draft')", [kind === "pages" ? "page" : kind === "projects" ? "project" : kind === "navigation" ? "navigation" : kind === "seo" ? "seo" : "settings", entityId, JSON.stringify(draft), actorId]);
    await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,'content.draft_saved',$2,$3,$4::jsonb,$5)", [actorId, kind, entityId, JSON.stringify({ kind }), requestId]);
  });
}

export async function publishContent(kind: ContentKind, key: string, actorId: string, requestId: string) {
  await assertActorIsOwner(actorId);
  await transaction(async (client) => {
    let row: { id?: string; draft: Record<string, unknown> } | undefined;
    if (kind === "settings") row = (await client.query<{ draft: Record<string, unknown> }>("SELECT draft FROM site_settings WHERE id='default' FOR UPDATE")).rows[0];
    else {
      const table = kind === "pages" ? "pages" : kind === "projects" ? "projects" : kind === "navigation" ? "navigation_items" : "seo_metadata";
      const col = kind === "pages" ? "key" : kind === "projects" ? "slug" : kind === "navigation" ? "id" : "route";
      row = (await client.query<{ id: string; draft: Record<string, unknown> }>(`SELECT id::text,draft FROM ${table} WHERE ${col}=$1 FOR UPDATE`, [key])).rows[0];
    }
    if (!row) throw new Error("Content record was not found.");
    const draft = validateDraft(kind, key, row.draft);
    const entityType = kind === "pages" ? "page" : kind === "projects" ? "project" : kind === "navigation" ? "navigation" : kind === "seo" ? "seo" : "settings";
    const entityId = kind === "settings" ? "default" : key;
    const revision = await client.query<{ id: string }>("INSERT INTO revisions(entity_type,entity_id,snapshot,author_id,publish_state) VALUES($1,$2,$3::jsonb,$4,'published') RETURNING id", [entityType, entityId, JSON.stringify(draft), actorId]);
    const table = kind === "settings" ? "site_settings" : kind === "pages" ? "pages" : kind === "projects" ? "projects" : kind === "navigation" ? "navigation_items" : "seo_metadata";
    const col = kind === "settings" ? "id" : kind === "pages" ? "key" : kind === "projects" ? "slug" : kind === "navigation" ? "id" : "route";
    const where = kind === "settings" ? "id='default'" : `${col}=$2`;
    const values = kind === "settings" ? [JSON.stringify(draft), revision.rows[0].id] : [JSON.stringify(draft), key, revision.rows[0].id];
    const bind = kind === "settings" ? "published_revision_id=$2" : "published_revision_id=$3";
    if (kind === "settings") await client.query("UPDATE site_settings SET published=$1::jsonb,status='published',published_at=now(),published_revision_id=$2,draft_updated_at=now() WHERE id='default'", values);
    else await client.query(`UPDATE ${table} SET published=$1::jsonb,status='published',published_at=now(),${bind},updated_at=now() WHERE ${where}`, values);
    if (kind === "projects") {
      if (typeof draft.image === "string" && draft.image.startsWith("media:")) {
        const mediaId = draft.image.slice("media:".length);
        const project = (await client.query<{ id: string }>("SELECT id FROM projects WHERE slug=$1", [key])).rows[0];
        const media = (await client.query<{ focal_x: number; focal_y: number }>("SELECT focal_x,focal_y FROM media WHERE id=$1 AND archived_at IS NULL AND processing_state='ready'", [mediaId])).rows[0];
        if (!project || !media) throw new Error("Select an available, validated image before publishing this project.");
        await client.query("DELETE FROM project_media WHERE project_id=$1 AND role='hero'", [project.id]);
        await client.query("INSERT INTO project_media(project_id,media_id,role,position,alt_text,focal_x,focal_y) VALUES($1,$2,'hero',0,$3,$4,$5) ON CONFLICT(project_id,media_id,role) DO UPDATE SET alt_text=EXCLUDED.alt_text,focal_x=EXCLUDED.focal_x,focal_y=EXCLUDED.focal_y", [project.id,mediaId,draft.imageAlt,media.focal_x,media.focal_y]);
      } else {
        const projectId = (await client.query<{ id: string }>("SELECT id FROM projects WHERE slug=$1", [key])).rows[0]?.id;
        if (projectId) await client.query("DELETE FROM project_media WHERE project_id=$1 AND role='hero'", [projectId]);
      }
    }
    if (kind === "navigation") {
      const nav = draft as z.infer<typeof navigationSchema>;
      await client.query("UPDATE navigation_items SET location=$1,label=$2,href=$3,position=$4,visible=$5 WHERE id=$6", [nav.location,nav.label,nav.href,nav.position,nav.visible,key]);
    }
    if (kind === "pages") {
      const pageId = row.id;
      const page = draft as z.infer<typeof pageSchema>;
      for (const section of page.sections) await client.query(
        `INSERT INTO page_sections(page_id,section_key,section_type,position,status,draft,published)
         VALUES($1,$2,$3,$4,'published',$5::jsonb,$5::jsonb)
         ON CONFLICT(page_id,section_key) DO UPDATE SET section_type=EXCLUDED.section_type,position=EXCLUDED.position,draft=EXCLUDED.draft,published=EXCLUDED.published,status='published'`,
        [pageId, section.key, section.type, section.position, JSON.stringify(section.content)],
      );
      await client.query("UPDATE page_sections SET status='archived' WHERE page_id=$1 AND NOT (section_key=ANY($2::text[]))", [pageId, page.sections.map((section) => section.key)]);
    }
    await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,'content.published',$2,$3,'{}'::jsonb,$4)", [actorId, entityType, entityId, requestId]);
  });
}

export async function restoreRevision(revisionId: string, actorId: string, requestId: string) {
  await assertActorIsOwner(actorId);
  await transaction(async (client) => {
    const revision = (await client.query<{ entity_type: string; entity_id: string; snapshot: Record<string, unknown> }>("SELECT entity_type,entity_id,snapshot FROM revisions WHERE id=$1", [revisionId])).rows[0];
    if (!revision) throw new Error("Revision was not found.");
    const mapping: Record<string, { table: string; column: string }> = { settings: { table: "site_settings", column: "id" }, page: { table: "pages", column: "key" }, project: { table: "projects", column: "slug" }, navigation: { table: "navigation_items", column: "id" }, seo: { table: "seo_metadata", column: "route" } };
    const target = mapping[revision.entity_type];
    if (!target) throw new Error("This revision type cannot be restored.");
    const key = revision.entity_type === "settings" ? "default" : revision.entity_id;
    const timestampColumn = revision.entity_type === "settings" ? "draft_updated_at" : "updated_at";
    const current = await client.query(`UPDATE ${target.table} SET draft=$1::jsonb,${timestampColumn}=now() WHERE ${target.column}::text=$2`, [JSON.stringify(revision.snapshot), key]);
    if (!current.rowCount) throw new Error("The source content record no longer exists.");
    if (revision.entity_type === "page") {
      const page = revision.snapshot as z.infer<typeof pageSchema>;
      const pageId = (await client.query<{ id: string }>("SELECT id FROM pages WHERE key=$1", [key])).rows[0]?.id;
      if (pageId) for (const section of page.sections) await client.query(
        `INSERT INTO page_sections(page_id,section_key,section_type,position,status,draft)
         VALUES($1,$2,$3,$4,'draft',$5::jsonb)
         ON CONFLICT(page_id,section_key) DO UPDATE SET section_type=EXCLUDED.section_type,position=EXCLUDED.position,draft=EXCLUDED.draft,status='draft'`,
        [pageId, section.key, section.type, section.position, JSON.stringify(section.content)],
      );
    }
    await client.query("INSERT INTO revisions(entity_type,entity_id,snapshot,author_id,publish_state,restores_revision_id) VALUES($1,$2,$3::jsonb,$4,'restored',$5)", [revision.entity_type, revision.entity_id, JSON.stringify(revision.snapshot), actorId, revisionId]);
    await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,'content.restored_as_draft',$2,$3,$4::jsonb,$5)", [actorId, revision.entity_type, revision.entity_id, JSON.stringify({ revisionId }), requestId]);
  });
}

export async function getDraft(kind: ContentKind, key: string): Promise<Record<string, unknown> | null> {
  const table = kind === "settings" ? "site_settings" : kind === "pages" ? "pages" : kind === "projects" ? "projects" : kind === "navigation" ? "navigation_items" : "seo_metadata";
  const col = kind === "settings" ? "id" : kind === "pages" ? "key" : kind === "projects" ? "slug" : kind === "navigation" ? "id" : "route";
  const row = (await query<{ draft: Record<string, unknown> }>(`SELECT draft FROM ${table} WHERE ${col}=$1`, [kind === "settings" ? "default" : key])).rows[0];
  return row?.draft ?? null;
}

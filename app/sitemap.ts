import type { MetadataRoute } from "next";
import { projects as fileProjects } from "@/content/projects";
import { getPublishedProjectDates, getPublishedProjects } from "@/lib/server/content/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const [projects, dates] = await Promise.all([getPublishedProjects(), getPublishedProjectDates()]);
  const projectSlugs = projects.length ? projects.map((project) => project.slug) : fileProjects.map((project) => project.slug);
  const paths = ["/", "/work", "/about", "/contact", ...projectSlugs.map((slug) => `/work/${slug}`)];
  return paths.map((path) => {
    const slug = path.startsWith("/work/") ? path.slice("/work/".length) : null;
    const lastModified = slug ? dates.get(slug) : undefined;
    return { url: origin ? `${origin}${path}` : path, ...(lastModified ? { lastModified } : {}) };
  });
}

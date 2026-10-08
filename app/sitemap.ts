import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const paths = ["/", "/work", "/about", "/contact", ...projects.map((project) => `/work/${project.slug}`)];
  return paths.map((path) => ({ url: origin ? `${origin}${path}` : path, lastModified: new Date() }));
}

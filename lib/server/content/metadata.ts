import "server-only";
import type { Metadata } from "next";
import { getPublishedSeo } from "./public";

export async function applyPublishedSeo(route: string, fallback: Metadata): Promise<Metadata> {
  const seo = await getPublishedSeo(route);
  if (!seo) return fallback;
  const canonical = seo.canonical ?? fallback.alternates?.canonical;
  const noindex = seo.robots.startsWith("noindex");
  const nofollow = seo.robots.endsWith("nofollow");
  return {
    ...fallback,
    title: seo.title,
    description: seo.description,
    alternates: { ...fallback.alternates, canonical },
    robots: { index: !noindex, follow: !nofollow },
    openGraph: { ...fallback.openGraph, title: seo.ogTitle ?? seo.title, description: seo.ogDescription ?? seo.description, ...(seo.ogImage ? { images: [seo.ogImage] } : {}) },
    twitter: { ...fallback.twitter, title: seo.ogTitle ?? seo.title, description: seo.ogDescription ?? seo.description, ...(seo.ogImage ? { images: [seo.ogImage] } : {}) },
  };
}

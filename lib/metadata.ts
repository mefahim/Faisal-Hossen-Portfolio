import type { Metadata } from "next";
import { site } from "@/content/site";

const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL;

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
};

export function createPageMetadata({ title, description, path, image, type = "website" }: PageMetadataOptions): Metadata {
  const absoluteImage = publicOrigin && image ? `${publicOrigin.replace(/\/$/, "")}${image}` : undefined;
  return {
    title,
    description,
    alternates: publicOrigin ? { canonical: path } : undefined,
    openGraph: {
      type,
      title,
      description,
      url: publicOrigin ? path : undefined,
      images: absoluteImage ? [{ url: absoluteImage, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
  };
}

export const siteMetadata: Metadata = {
  metadataBase: publicOrigin ? new URL(publicOrigin) : undefined,
  title: {
    default: "Fahim — Digital Problem Solver",
    template: "%s — Fahim",
  },
  description:
    "Fahim designs and builds thoughtful digital solutions that solve real problems, simplify workflows, and create better experiences.",
  keywords: ["Fahim", "digital problem solver", "web developer", "UX", "automation", "SEO"],
  authors: [{ name: site.name }],
  creator: site.name,
  alternates: publicOrigin ? { canonical: "/" } : undefined,
  openGraph: {
    type: "website",
    siteName: "Fahim — Digital Problem Solver",
    title: site.positioning,
    description: site.supporting,
    url: publicOrigin ? "/" : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: site.positioning,
    description: site.supporting,
  },
  robots: { index: true, follow: true },
};

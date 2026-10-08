import type { Metadata } from "next";
import { site } from "@/content/site";

const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL;

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

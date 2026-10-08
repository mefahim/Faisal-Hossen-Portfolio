import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/faisals-room", "/faisals-room/"] },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}

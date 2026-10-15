"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function TrackPageViews({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the initial mount: gtag('config') in the init script already
    // sends the first page_view. This prevents duplicate events.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window.gtag !== "function") return;
    const query = searchParams?.toString();
    window.gtag("config", measurementId, {
      page_path: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams, measurementId]);

  return null;
}

/**
 * GA4 client-side tracking via gtag.js.
 *
 * Renders nothing when measurementId is empty (env var unset) — the tag
 * is never loaded in that case. Uses next/script with afterInteractive
 * strategy per Next.js best practices.
 *
 * Page views:
 * - Initial load: gtag('config') sends page_view automatically.
 * - App Router client-side navigations: TrackPageViews sends one
 *   page_view per route change (first render skipped to avoid duplicates).
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  if (!measurementId) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
      <Suspense fallback={null}>
        <TrackPageViews measurementId={measurementId} />
      </Suspense>
    </>
  );
}

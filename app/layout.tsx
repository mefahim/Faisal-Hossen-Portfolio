import type { ReactNode } from "react";
import { DM_Sans, Inter } from "next/font/google";
import { siteMetadata } from "@/lib/metadata";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = siteMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  // GA4 Measurement ID from env. When unset, GoogleAnalytics renders nothing
  // and no tracking tag is loaded.
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
        <GoogleAnalytics measurementId={gaMeasurementId} />
      </body>
    </html>
  );
}

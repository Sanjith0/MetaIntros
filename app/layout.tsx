import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HydrationMarker } from "@/components/HydrationMarker";
import { ClockSync } from "@/components/ClockSync";
import { getClockOffsetMs } from "@/lib/server/clock";

// Every page reads the global clock at request time (never baked into a prebuilt page).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Link · hackathon prototype",
  description: "A hackathon prototype of a Facebook Events feature: go to events with a small squad. Not Facebook.",
  // Prototype: never indexed (DESIGN.md §1.9). next.config.ts also sends X-Robots-Tag on every response.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "white",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const offsetMs = await getClockOffsetMs();
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:shadow-elevated">
          Skip to content
        </a>
        <ClockSync offsetMs={offsetMs} />
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}

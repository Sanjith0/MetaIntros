import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HydrationMarker } from "@/components/HydrationMarker";
import { ClockSync } from "@/components/ClockSync";
import { getClockOffsetMs } from "@/lib/server/clock";

// Every page reads the global clock at request time (never baked into a prebuilt page).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Queue Up · Facebook Events",
  description: "Go to events with a small, compatible squad.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1877F2",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const offsetMs = await getClockOffsetMs();
  return (
    <html lang="en">
      <body className="antialiased">
        <ClockSync offsetMs={offsetMs} />
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}

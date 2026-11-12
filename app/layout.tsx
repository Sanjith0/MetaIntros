import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HydrationMarker } from "@/components/HydrationMarker";

export const metadata: Metadata = {
  title: "Queue Up · Facebook Events",
  description: "Go to events with a small, compatible squad.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1877F2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}

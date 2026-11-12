import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crews · Facebook Events",
  description: "Queue up for events with a crew Muse builds for you.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#e4e6eb]">
        <div className="mx-auto min-h-dvh max-w-[440px] bg-[#f0f2f5] shadow-xl relative">{children}</div>
      </body>
    </html>
  );
}

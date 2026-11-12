import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DEMO_IDS } from "@/fixtures";
import { MobilePrototypeLabel, TopBar } from "@/components/TopBar";
import { LiveProvider } from "@/components/live/LiveProvider";
import { Toaster, type Directory } from "@/components/live/Toaster";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import { flag } from "@/lib/flags";
import { unreadCount } from "@/lib/server/notifications";

export const metadata: Metadata = {
  title: { default: "Party Queue (hackathon prototype)", template: "%s · Party Queue prototype" },
  description: "Hackathon prototype, not Facebook. Seeded, fictional data only.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewerId = await currentViewerId();
  const s = store();
  const all = [...s.profiles.values()];
  const toP = (p: (typeof all)[number]) => ({ id: p.id, name: p.name, hue: p.avatarHue });
  const viewer = s.profiles.get(viewerId)!;
  const demoSet = new Set<string>(DEMO_IDS);
  const people: Directory = Object.fromEntries(all.map((p) => [p.id, { name: p.name, firstName: p.firstName, hue: p.avatarHue }]));

  return (
    <html lang="en">
      <body className="min-h-screen">
        {flag("UX_STATES") && (
        <a href="#main" className="sr-only z-[80] rounded-[6px] bg-white px-3 py-2 text-[15px] font-semibold text-[var(--color-link)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3" data-testid="skip-link">
          Skip to content
        </a>
        )}
        <LiveProvider viewerId={viewerId}>
          <TopBar
            viewer={toP(viewer)}
            demo={all.filter((p) => demoSet.has(p.id)).map(toP)}
            others={all.filter((p) => !demoSet.has(p.id)).map(toP)}
            unread={flag("NOTIFICATIONS_LIST") ? unreadCount(viewerId) : null}
          />
          <MobilePrototypeLabel />
          <div data-viewer={viewerId} id="main" tabIndex={-1} className="outline-none">
            {children}
          </div>
          <Toaster people={people} keyboard={flag("UX_STATES")} />
        </LiveProvider>
      </body>
    </html>
  );
}

import { TabBar } from "@/components/fb/TabBar";
import { AppStateProvider } from "@/components/fb/AppState";
import { ToastProvider } from "@/components/fb/Toast";
import { LiveRefresher } from "@/components/LiveRefresher";
import { getBadges } from "@/lib/server/badges";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  const badges = await getBadges(me.id);
  return (
    <AppStateProvider me={{ id: me.id, name: me.name, avatarColor: me.avatarColor }} initial={badges}>
      <ToastProvider>
        <div className="mx-auto min-h-dvh max-w-md bg-wash pb-[calc(52px+env(safe-area-inset-bottom))]">
          <main id="main">{children}</main>
        </div>
        <TabBar />
        <LiveRefresher />
      </ToastProvider>
    </AppStateProvider>
  );
}

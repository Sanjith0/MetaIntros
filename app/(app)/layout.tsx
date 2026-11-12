import { Header } from "@/components/Header";
import { TabBar } from "@/components/TabBar";
import { LiveRefresher } from "@/components/LiveRefresher";
import { getBadges } from "@/lib/server/badges";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  const badges = await getBadges(me.id);
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-fb-bg pb-20">
      <Header me={me} />
      <main>{children}</main>
      <TabBar initial={badges} />
      <LiveRefresher />
    </div>
  );
}

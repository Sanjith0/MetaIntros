import Link from "next/link";
import { TabBar, TopBar } from "@/components/ui";

export default function CrewsTab() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar title="Crews" />
      <main className="flex-1 p-4 space-y-3">
        <p className="text-sub">Your crews show up here after you join one from an event.</p>
        <Link href="/events/pale-hour" className="text-fb font-semibold">Find an event with crews →</Link>
      </main>
      <TabBar active="/crews" />
    </div>
  );
}

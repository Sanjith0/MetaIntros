"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ME } from "@/data/seed";
import { MuseMark, TabBar, TopBar } from "@/components/ui";

export default function Notifications() {
  const [s, setS] = useState<{ crewId: string | null; nearby: unknown[] } | null>(null);
  useEffect(() => {
    fetch(`/api/queue/status?eventId=pale-hour&userId=${ME}`).then((r) => r.json()).then(setS);
  }, []);
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1">
        <h1 className="text-2xl font-bold px-4 py-2">Notifications</h1>
        {s?.crewId && (
          <Link href={`/crew/${s.crewId}`} className="flex gap-3 px-4 py-3 bg-[#e7f0ff]">
            <div className="w-14 h-14 rounded-full bg-[#f3ecff] grid place-items-center shrink-0"><MuseMark size={28} /></div>
            <div className="text-[15px]"><b>Your crew for Pale Hour is ready.</b> Meet them before the show.<div className="text-[13px] text-fb font-semibold">Just now</div></div>
          </Link>
        )}
        <Link href="/events/pale-hour" className="flex gap-3 px-4 py-3 bg-[#e7f0ff]">
          <div className="w-14 h-14 rounded-full bg-[#f3ecff] grid place-items-center shrink-0"><MuseMark size={28} /></div>
          <div className="text-[15px]">
            <b>{s ? Math.max(0, s.nearby.length - 1) : "Some"} people near South Congress</b> are looking for a crew for <b>Pale Hour</b> on Saturday.
            <div className="text-[13px] text-fb font-semibold">12m</div>
          </div>
        </Link>
        <div className="flex gap-3 px-4 py-3">
          <div className="w-14 h-14 rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#7fb5ff,#1e6fd9)" }} />
          <div className="text-[15px]"><b>Lena Park</b> mentioned you in a post.<div className="text-[13px] text-sub">5h</div></div>
        </div>
      </main>
      <TabBar active="/notifications" />
    </div>
  );
}

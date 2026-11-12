"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EVENTS, ME, VENUES, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import type { CrewView } from "@/lib/types";
import { Avatar, MuseMark, TabBar, TopBar } from "@/components/ui";

export default function CrewsTab() {
  const [crews, setCrews] = useState<CrewView[] | null>(null);
  useEffect(() => {
    fetch(`/api/crews?userId=${ME}`).then((r) => r.json()).then(setCrews);
  }, []);
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar back="/menu" title="Crews" />
      <main className="flex-1 p-3 space-y-2">
        {crews?.length === 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 font-semibold"><MuseMark /> No crews yet</div>
            <p className="text-sub text-[15px] mt-1">Join a crew from any event with “Crews forming nearby”.</p>
            <Link href="/events/pale-hour" className="mt-3 inline-block text-fb font-semibold">Find an event →</Link>
          </div>
        )}
        {crews?.map((c) => {
          const ev = EVENTS.find((e) => e.id === c.eventId)!;
          const v = VENUES.find((x) => x.id === c.plan.venueId)!;
          const last = c.chat[c.chat.length - 1];
          return (
            <Link key={c.id} href={c.allAccepted ? `/crew/${c.id}/chat` : `/crew/${c.id}`} className="bg-white rounded-xl p-3 shadow-sm flex gap-3 items-center" data-testid="crew-row">
              <div className="flex -space-x-3">
                {c.memberIds.slice(0, 3).map((m) => (
                  <Avatar key={m} p={profileById(m)!} size={36} ring="#fff" blurred={!c.allAccepted && m !== ME} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{c.vibe} · {ev.title.split(" — ")[0]}</div>
                <div className="text-[13px] text-sub truncate">{last ? last.text : `${v.name} · ${pretty(c.plan.time)}`}</div>
              </div>
            </Link>
          );
        })}
      </main>
      <TabBar active="/menu" />
    </div>
  );
}

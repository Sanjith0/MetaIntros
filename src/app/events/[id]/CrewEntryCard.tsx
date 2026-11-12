"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ME } from "@/data/seed";
import { Avatar, MuseMark } from "@/components/ui";

interface Status {
  bucket: { name: string };
  nearby: { id: string; name: string; hue: number }[];
  crewId: string | null;
}

export function CrewEntryCard({ eventId }: { eventId: string }) {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch(`/api/queue/status?eventId=${eventId}&userId=${ME}`).then((r) => r.json()).then(setS);
  }, [eventId]);
  const others = s?.nearby.filter((n) => n.id !== ME) ?? [];
  return (
    <section className="rounded-xl p-[2px] muse-shimmer shadow-md" data-testid="crew-entry">
      <div className="bg-white rounded-[10px] p-4">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muse">
          <MuseMark /> NEW · Crews
        </div>
        <h2 className="font-bold text-[19px] leading-snug mt-1">Going solo? Join a crew.</h2>
        <p className="text-[15px] text-sub mt-1">
          We&apos;ll match you with 5–7 people near you who&apos;d actually get along, pick a spot to meet first, and walk in together.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-2">
            {others.slice(0, 5).map((p) => (
              <Avatar key={p.id} p={p} size={28} blurred ring="#fff" />
            ))}
          </div>
          <span className="text-sm text-sub">
            {s ? `${others.length} people queued near ${s.bucket.name}` : "Checking the queue…"}
          </span>
        </div>
        {s?.crewId ? (
          <Link href={`/crew/${s.crewId}`} className="mt-3 h-10 rounded-lg bg-fb text-white font-semibold grid place-items-center">
            View your crew
          </Link>
        ) : (
          <Link href={`/events/${eventId}/crew`} className="mt-3 h-10 rounded-lg bg-fb text-white font-semibold grid place-items-center" data-testid="join-crew">
            Join a crew
          </Link>
        )}
        <p className="text-[12px] text-sub mt-2">Opt-in · 18+ · Photos stay hidden until everyone in the crew says yes.</p>
      </div>
    </section>
  );
}

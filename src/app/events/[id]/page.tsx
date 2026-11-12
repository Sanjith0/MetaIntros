import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENTS, ME, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { TopBar } from "@/components/ui";
import { CrewEntryCard } from "./CrewEntryCard";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = EVENTS.find((x) => x.id === id);
  if (!e) notFound();
  const me = profileById(ME)!;
  const date = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="min-h-dvh pb-8">
      <TopBar back="/events" title={e.title} />
      <div className="h-48" style={{ background: e.cover }} />
      <div className="bg-white px-4 pt-3 pb-4">
        <div className="text-[13px] font-semibold text-[#c2185b] uppercase">
          {date} at {pretty(e.startTime)}
        </div>
        <h1 className="font-bold text-2xl leading-tight mt-1">{e.title}</h1>
        <div className="text-sub mt-1">{e.venueName}</div>
        <div className="flex gap-2 mt-3">
          <button className="flex-1 h-9 rounded-lg bg-[#e7f0ff] text-fb font-semibold">★ Interested</button>
          <button className="flex-1 h-9 rounded-lg bg-[#e4e6eb] font-semibold">✓ Going</button>
          <button className="w-11 h-9 rounded-lg bg-[#e4e6eb]">⋯</button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <CrewEntryCard eventId={e.id} />
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-[17px]">Details</h2>
          <p className="text-[15px] mt-2">{e.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {e.tags.map((t) => (
              <span key={t} className="text-xs bg-fbbg px-2 py-1 rounded-full">{t}</span>
            ))}
          </div>
          <div className="text-sub text-sm mt-3">
            {e.goingCount} going · {e.interestedCount.toLocaleString()} interested · Hosted by {e.host}
          </div>
          <div className="text-sub text-sm mt-1">0 of your friends are going, {me.name}.</div>
        </section>
        <Link href="/events" className="block text-center text-fb text-sm">See more events</Link>
      </div>
    </div>
  );
}

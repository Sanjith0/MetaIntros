import Link from "next/link";
import { CircleCheck, Flag, Globe, Mail, MapPin, MoreHorizontal, Star, Users } from "lucide-react";
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
        <div className="text-[13px] font-semibold text-[#e41e3f] uppercase">
          {date} at {pretty(e.startTime)}
        </div>
        <h1 className="font-bold text-2xl leading-tight mt-1">{e.title}</h1>
        <div className="text-sub mt-1">{e.venueName}</div>
        <div className="flex gap-2 mt-3">
          <button className="flex-[1.3] h-9 rounded-md bg-fb text-white font-semibold text-[14px] flex items-center justify-center gap-1"><Star size={16} fill="#fff" /> Interested</button>
          <button className="flex-1 h-9 rounded-md bg-[#e4e6eb] font-semibold text-[14px] flex items-center justify-center gap-1"><CircleCheck size={16} /> Going</button>
          <button className="flex-1 h-9 rounded-md bg-[#e4e6eb] font-semibold text-[14px] flex items-center justify-center gap-1"><Mail size={16} /> Invite</button>
          <button className="w-11 h-9 rounded-md bg-[#e4e6eb] grid place-items-center" aria-label="More"><MoreHorizontal size={18} /></button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <CrewEntryCard eventId={e.id} />
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-[17px]">Details</h2>
          <ul className="mt-2 space-y-2.5 text-[15px]">
            <li className="flex gap-3"><Users size={22} className="text-sub shrink-0" /> {e.goingCount + e.interestedCount} people responded</li>
            <li className="flex gap-3"><Flag size={22} className="text-sub shrink-0" /> <span>Event by <b>{e.host}</b></span></li>
            <li className="flex gap-3"><MapPin size={22} className="text-sub shrink-0" /> {e.venueName}</li>
            <li className="flex gap-3"><Globe size={22} className="text-sub shrink-0" /> Public · Anyone on or off Facebook</li>
          </ul>
          <p className="text-[15px] mt-3">{e.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {e.tags.map((t) => (
              <span key={t} className="text-[13px] font-semibold bg-[#e4e6eb] px-3 py-1 rounded-full">{t}</span>
            ))}
          </div>
          <div className="text-sub text-sm mt-3">0 of your friends are going, {me.name}.</div>
        </section>
        <Link href="/events" className="block text-center text-fb text-sm">See more events</Link>
      </div>
    </div>
  );
}

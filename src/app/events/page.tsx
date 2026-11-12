import Link from "next/link";
import { Search, Share2, Star } from "lucide-react";
import { EVENTS } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { TabBar, TopBar } from "@/components/ui";

const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

export default function EventsPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1 pb-3">
        <div className="bg-white px-4 pt-1 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-2xl">Events</h1>
            <span className="w-9 h-9 rounded-full bg-[#e4e6eb] grid place-items-center"><Search size={20} /></span>
          </div>
          <div className="flex gap-2 overflow-x-auto mt-2 text-[15px] font-semibold -mx-1 px-1">
            {["For you", "Local", "This week", "Friends", "Following", "✦ Crews"].map((t, i) => (
              <span key={t} className={`px-3 h-9 grid place-items-center rounded-full whitespace-nowrap ${i === 0 ? "bg-[#e7f0ff] text-fb" : "bg-[#e4e6eb]"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
          <h2 className="font-bold text-[17px]">Popular near Austin, TX</h2>
          <span className="text-fb text-[15px]">See all</span>
        </div>
        <div className="px-3 space-y-3">
          {EVENTS.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="block bg-white rounded-xl overflow-hidden shadow-sm" data-testid={`event-${e.id}`}>
              <div className="h-40 relative" style={{ background: e.cover }}>
                {e.id === "pale-hour" && <span className="absolute top-2 left-2 bg-white/95 text-[12px] font-semibold px-2 py-1 rounded-full">✦ Crews forming nearby</span>}
              </div>
              <div className="p-3">
                <div className="text-[13px] font-semibold text-[#e41e3f]">{day(e.date)} AT {pretty(e.startTime)}</div>
                <div className="font-bold text-[17px] leading-tight mt-0.5">{e.title}</div>
                <div className="text-sub text-[14px] mt-0.5">{e.venueName}</div>
                <div className="text-sub text-[14px]">{e.interestedCount.toLocaleString()} interested · {e.goingCount} going</div>
                <div className="flex gap-2 mt-2.5">
                  <span className="flex-1 h-9 rounded-md bg-[#e4e6eb] font-semibold text-[15px] flex items-center justify-center gap-1.5"><Star size={17} /> Interested</span>
                  <span className="w-11 h-9 rounded-md bg-[#e4e6eb] grid place-items-center"><Share2 size={17} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <TabBar active="/events" />
    </div>
  );
}

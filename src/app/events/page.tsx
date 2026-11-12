import Link from "next/link";
import { EVENTS } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { TabBar, TopBar } from "@/components/ui";

const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

export default function EventsPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1 p-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
          {["For you", "Local", "This weekend", "Friends", "Crews"].map((t, i) => (
            <span key={t} className={`px-3 py-1.5 rounded-full whitespace-nowrap ${i === 0 ? "bg-[#e7f0ff] text-fb font-semibold" : "bg-white"}`}>
              {t}
            </span>
          ))}
        </div>
        <h2 className="font-bold text-xl px-1">Events near Austin</h2>
        {EVENTS.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="block bg-white rounded-xl overflow-hidden shadow-sm" data-testid={`event-${e.id}`}>
            <div className="h-36 relative" style={{ background: e.cover }}>
              {e.id === "pale-hour" && (
                <span className="absolute top-2 left-2 bg-white/95 text-[12px] font-semibold px-2 py-1 rounded-full">✦ Crews forming nearby</span>
              )}
            </div>
            <div className="p-3">
              <div className="text-[13px] font-semibold text-[#c2185b]">
                {day(e.date)} AT {pretty(e.startTime)}
              </div>
              <div className="font-bold text-[17px] leading-tight">{e.title}</div>
              <div className="text-sub text-sm">{e.venueName}</div>
              <div className="text-sub text-sm">
                {e.interestedCount.toLocaleString()} interested · {e.goingCount} going
              </div>
            </div>
          </Link>
        ))}
      </main>
      <TabBar active="/events" />
    </div>
  );
}

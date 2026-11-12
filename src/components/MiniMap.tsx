"use client";
import { EVENTS, VENUES, profileById } from "@/data/seed";
import type { CrewView } from "@/lib/types";
import { Avatar } from "@/components/ui";

export function MiniMap({ crew, arrived }: { crew: CrewView; arrived?: boolean }) {
  const ev = EVENTS.find((e) => e.id === crew.eventId)!;
  const venue = VENUES.find((v) => v.id === crew.plan.venueId)!;
  const pts = [ev, venue];
  const lat0 = (ev.lat + venue.lat) / 2;
  const lng0 = (ev.lng + venue.lng) / 2;
  const span = Math.max(Math.abs(ev.lat - venue.lat), Math.abs(ev.lng - venue.lng), 0.002) * 1.6;
  const xy = (p: { lat: number; lng: number }) => ({ x: 50 + ((p.lng - lng0) / span) * 80, y: 50 - ((p.lat - lat0) / span) * 80 });
  const [a, b] = pts.map(xy);
  return (
    <div className="relative mt-3 h-40 rounded-lg overflow-hidden bg-[#e8f0e5]" aria-label="Map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {[15, 35, 55, 75, 95].map((v) => (
          <g key={v} stroke="#fff" strokeWidth="2.2">
            <line x1={v} y1="0" x2={v - 8} y2="100" />
            <line x1="0" y1={v} x2="100" y2={v + 6} />
          </g>
        ))}
        <line x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke="#0866ff" strokeWidth="1.6" strokeDasharray="3 2" />
      </svg>
      <Pin x={b.x} y={b.y} label={venue.name} color="#7b3fe4" />
      <Pin x={a.x} y={a.y} label={ev.venueName.split(",")[0]} color="#c2185b" />
      {arrived && (
        <div className="absolute flex -space-x-2" style={{ left: `${b.x}%`, top: `${b.y + 8}%`, transform: "translateX(-50%)" }}>
          {crew.arrived.map((id) => (
            <div key={id} className="pop-in"><Avatar p={profileById(id)!} size={24} ring="#fff" /></div>
          ))}
        </div>
      )}
      <div className="absolute bottom-1.5 right-2 text-[11px] bg-white/90 rounded px-1.5">{crew.plan.walkToEventMin} min walk</div>
    </div>
  );
}

function Pin({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center" style={{ left: `${x}%`, top: `${y}%` }}>
      <span className="text-[11px] font-semibold bg-white rounded px-1.5 py-0.5 shadow whitespace-nowrap">{label}</span>
      <span className="w-3 h-3 rounded-full mt-0.5 border-2 border-white shadow" style={{ background: color }} />
    </div>
  );
}


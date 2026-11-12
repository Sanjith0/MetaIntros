"use client";

import { Avatar } from "@/components/fb";
import { cn } from "@/components/fb/cn";

export interface SearchAreaView {
  radiusKm: number;
  center: { id: string; name: string; lat: number; lng: number };
  areas: { id: string; name: string; lat: number; lng: number; km: number; inRange: boolean; waiting: number | null }[];
}

/** Map edge in km (matches SEARCH_MAP_KM on the server). */
const EDGE_KM = 15;
const SIZE = 148;
const HALF = SIZE / 2;
const REACH = HALF - 8;
/** Square-root scale, so nearby areas don't pile onto your own. */
const toPx = (km: number) => Math.sqrt(Math.min(km, EDGE_KM) / EDGE_KM) * REACH;

/**
 * Where your search reaches right now: your area in the middle, other areas placed by real direction,
 * and a blue circle that grows as the queue widens the search. Counts only (and only at 5 or more),
 * never faces.
 */
export function SearchMap({ area, me }: { area: SearchAreaView; me?: { name: string; avatarColor: string } }) {
  const c = area.center;
  const kx = 111 * Math.cos((c.lat * Math.PI) / 180);
  const spots = area.areas
    .filter((a) => a.id !== c.id)
    .map((a) => {
      const dx = (a.lng - c.lng) * kx;
      const dy = (a.lat - c.lat) * 111;
      const d = Math.hypot(dx, dy) || 1;
      const r = toPx(a.km);
      return { ...a, x: HALF + (dx / d) * r, y: HALF - (dy / d) * r };
    });
  const ring = area.radiusKm > 0 ? toPx(area.radiusKm) : 18;
  const here = area.areas.find((a) => a.id === c.id);
  const reached = [here!, ...spots.filter((s) => s.inRange).sort((a, b) => a.km - b.km)].filter(Boolean);
  const shown = reached.slice(0, 4);

  return (
    <figure className="mt-4 flex items-center gap-4 rounded-card bg-wash p-3" data-testid="search-map" data-radius={area.radiusKm}>
      <div className="relative shrink-0 overflow-hidden rounded-full bg-surface" style={{ width: SIZE, height: SIZE }} aria-hidden>
        {[1, 6, 15].map((km) => (
          <span key={km} className="absolute rounded-full border border-divider" style={{ left: HALF - toPx(km), top: HALF - toPx(km), width: toPx(km) * 2, height: toPx(km) * 2 }} />
        ))}
        <span
          className="absolute rounded-full border-2 border-accent bg-on transition-all duration-300 ease-out"
          style={{ left: HALF - ring, top: HALF - ring, width: ring * 2, height: ring * 2 }}
          data-testid="search-ring"
        />
        {spots.map((s) => (
          <span
            key={s.id}
            className={cn("absolute h-2 w-2 rounded-full ring-2 ring-surface transition-colors duration-200", s.inRange ? "bg-accent" : "bg-disabled")}
            style={{ left: s.x - 4, top: s.y - 4 }}
            data-testid={s.inRange ? "map-area-in" : "map-area-out"}
          />
        ))}
        {me && (
          <span className="absolute" style={{ left: HALF - 13, top: HALF - 13 }}>
            <Avatar name={me.name} color={me.avatarColor} size={26} ring />
          </span>
        )}
      </div>
      <figcaption className="min-w-0 flex-1" data-testid="search-caption">
        <p className="text-body font-semibold">Search area</p>
        <p className="text-meta text-muted">{area.radiusKm === 0 ? "Your area only" : `Within ${area.radiusKm} km of you`}</p>
        <ul className="mt-2 space-y-1" data-testid="search-areas">
          {shown.map((a) => (
            <li key={a.id} className="flex items-center gap-1.5 text-meta">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              <span className="truncate">{a.name}</span>
              {a.waiting ? <span className="shrink-0 text-muted">· {a.waiting} queuing</span> : null}
            </li>
          ))}
          {reached.length > shown.length && <li className="pl-3.5 text-meta text-muted">and {reached.length - shown.length} more</li>}
        </ul>
      </figcaption>
    </figure>
  );
}


"use client";

import { useState } from "react";
import { Avatar, FacePile } from "@/components/Avatar";
import { IconClose } from "@/components/icons";

interface P {
  id: string;
  name: string;
  hue: number;
}

/** Guests card: two counters, a face pile, a friends line, and the
 *  "See all" guest list dialog with Going / Interested tabs. */
export function GuestsCard({
  going,
  interested,
  goingPeople,
  interestedPeople,
  friendsGoing,
  partyIds,
}: {
  going: number;
  interested: number;
  goingPeople: P[];
  interestedPeople: P[];
  friendsGoing: P[];
  partyIds: string[];
}) {
  const [open, setOpen] = useState<null | "going" | "interested">(null);
  const list = open === "interested" ? interestedPeople : goingPeople;
  const extra = open === "interested" ? interested - interestedPeople.length : going - goingPeople.length;

  return (
    <section className="rounded-[8px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="guests-card">
      <div className="flex items-center justify-between">
        <h3 className="text-[20px] font-bold">Guests</h3>
        <button className="rounded-[6px] px-2 py-1 text-[15px] text-[var(--color-link)] hover:bg-black/5" onClick={() => setOpen("going")}>
          See all
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <button className="rounded-[8px] py-2 hover:bg-black/5" onClick={() => setOpen("going")} data-testid="going-count">
          <div className="text-[20px] font-bold">{going.toLocaleString("en-US")}</div>
          <div className="text-[13px] text-[var(--color-ink-2)]">Going</div>
        </button>
        <button className="rounded-[8px] py-2 hover:bg-black/5" onClick={() => setOpen("interested")}>
          <div className="text-[20px] font-bold">{interested.toLocaleString("en-US")}</div>
          <div className="text-[13px] text-[var(--color-ink-2)]">Interested</div>
        </button>
      </div>
      {goingPeople.length > 0 && (
        <div className="mt-3 flex items-center gap-3 border-t border-[var(--color-divider)] pt-3">
          <FacePile people={goingPeople} size={32} />
          <span className="text-[13px] text-[var(--color-ink-2)]">
            {friendsGoing.length > 0
              ? `${friendsGoing.map((f) => f.name.split(" ")[0]).join(", ")} ${friendsGoing.length === 1 ? "is" : "are"} going`
              : `${goingPeople.length} ${goingPeople.length === 1 ? "person" : "people"} you can see ${goingPeople.length === 1 ? "is" : "are"} going`}
          </span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4" role="dialog" aria-label="Guest list" onClick={() => setOpen(null)}>
          <div className="w-full max-w-[548px] rounded-[8px] bg-white shadow-[var(--shadow-elevated)]" onClick={(e) => e.stopPropagation()}>
            <div className="relative border-b border-[var(--color-divider)] px-4 py-4 text-center text-[20px] font-bold">
              Guests
              <button aria-label="Close" onClick={() => setOpen(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-btn-2)]">
                <IconClose size={18} />
              </button>
            </div>
            <div className="flex gap-1 border-b border-[var(--color-divider)] px-4">
              {(["going", "interested"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOpen(t)}
                  className={`px-4 py-3 text-[15px] font-semibold capitalize ${open === t ? "border-b-[3px] border-[var(--color-accent)] text-[var(--color-accent)]" : "text-[var(--color-ink-2)]"}`}
                >
                  {t} · {(t === "going" ? going : interested).toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-[8px] px-2 py-2 hover:bg-black/5">
                  <Avatar name={p.name} hue={p.hue} size={40} />
                  <span className="flex-1 text-[15px] font-semibold">{p.name}</span>
                  {partyIds.includes(p.id) && (
                    <span className="rounded bg-[var(--color-pq-soft)] px-2 py-0.5 text-[12px] font-semibold text-[var(--color-pq)]">Your party</span>
                  )}
                </li>
              ))}
              {extra > 0 && <li className="px-2 py-3 text-[13px] text-[var(--color-ink-2)]">and {extra.toLocaleString("en-US")} others not shown in this prototype</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

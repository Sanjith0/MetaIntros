"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconCheck, IconStar } from "@/components/icons";

type Rsvp = "interested" | "going" | null;

async function save(eventId: string, status: Rsvp) {
  await fetch("/api/rsvp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, status }) });
}

/** Interested and Going. Off: grey. On: light blue with blue ink.
 *  Only one can be on. Tapping an active one turns it off. */
export function RsvpButtons({ eventId, initial, compact = false }: { eventId: string; initial: Rsvp; compact?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Rsvp>(initial);
  const [, start] = useTransition();

  const toggle = (next: Exclude<Rsvp, null>) => {
    const value = state === next ? null : next;
    setState(value);
    start(async () => {
      await save(eventId, value);
      router.refresh();
    });
  };

  const cls = (on: boolean) =>
    `press flex h-9 items-center justify-center gap-1.5 rounded-[6px] px-3 text-[15px] font-semibold transition-colors ${
      on ? "bg-[var(--color-on-bg)] text-[var(--color-on-ink)]" : "bg-[var(--color-btn-2)] text-[var(--color-ink)] hover:bg-[var(--color-btn-2-hover)]"
    } ${compact ? "w-full" : ""}`;

  if (compact) {
    return (
      <button data-testid="rsvp-interested" aria-pressed={state === "interested"} className={cls(state === "interested")} onClick={() => toggle("interested")}>
        <IconStar size={18} /> Interested
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button data-testid="rsvp-interested" aria-pressed={state === "interested"} className={cls(state === "interested")} onClick={() => toggle("interested")}>
        <IconStar size={18} /> Interested
      </button>
      <button data-testid="rsvp-going" aria-pressed={state === "going"} className={cls(state === "going")} onClick={() => toggle("going")}>
        <IconCheck size={18} /> Going
      </button>
    </div>
  );
}

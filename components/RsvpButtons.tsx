"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";

export function RsvpButtons({ eventId, initial }: { eventId: string; initial: string | null }) {
  const [status, setStatus] = useState<string | null>(initial);
  const set = async (s: "interested" | "going") => {
    const next = status === s ? null : s;
    setStatus(next);
    await fetch(`/api/events/${eventId}/rsvp`, { method: "POST", body: JSON.stringify({ status: next }) });
  };
  const cls = (on: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-semibold ${on ? "bg-fb-blue text-white" : "bg-[#e4e6eb] text-fb-text"}`;
  return (
    <div className="flex gap-2">
      <button type="button" data-testid="rsvp-interested" aria-pressed={status === "interested"} className={cls(status === "interested")} onClick={() => set("interested")}>
        <Star size={18} /> Interested
      </button>
      <button type="button" data-testid="rsvp-going" aria-pressed={status === "going"} className={cls(status === "going")} onClick={() => set("going")}>
        <Check size={18} /> Going
      </button>
    </div>
  );
}

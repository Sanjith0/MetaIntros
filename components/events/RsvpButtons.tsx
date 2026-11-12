"use client";

import { useEffect, useState } from "react";
import { Check, Mail, MoreHorizontal, Share2, Star } from "lucide-react";
import { Button, cn } from "@/components/fb";
import { useToast } from "@/components/fb/Toast";

type Rsvp = "interested" | "going" | null;

function useRsvp(eventId: string, initial: string | null) {
  const [status, setStatus] = useState<Rsvp>(initial as Rsvp);
  const set = async (s: "interested" | "going") => {
    const next = status === s ? null : s;
    setStatus(next);
    await fetch(`/api/events/${eventId}/rsvp`, { method: "POST", body: JSON.stringify({ status: next }) }).catch(() => {});
  };
  return [status, set] as const;
}

/** Event page action row: equal-width Interested, Going, Invite + "…" (EVENT_PAGE.md §4). */
export function ActionRow({ eventId, initial }: { eventId: string; initial: string | null }) {
  const [status, set] = useRsvp(eventId, initial);
  const [ready, setReady] = useState(false);
  const toast = useToast();
  useEffect(() => setReady(true), []);
  return (
    <div className="flex gap-2" data-testid="rsvp" data-ready={ready}>
      <Button className="flex-1" variant={status === "interested" ? "on" : "secondary"} aria-pressed={status === "interested"} data-testid="rsvp-interested" icon={<Star size={16} fill={status === "interested" ? "currentColor" : "none"} />} onClick={() => set("interested")}>
        Interested
      </Button>
      <Button className="flex-1" variant={status === "going" ? "on" : "secondary"} aria-pressed={status === "going"} data-testid="rsvp-going" icon={<Check size={16} />} onClick={() => set("going")}>
        Going
      </Button>
      <Button className="flex-1" icon={<Mail size={16} />} onClick={() => toast("Invites are off in this prototype.")}>
        Invite
      </Button>
      <Button aria-label="More" className="w-9 px-0" onClick={() => toast("More options are off in this prototype.")}>
        <MoreHorizontal size={18} />
      </Button>
    </div>
  );
}

/** Feed card footer: full-width Interested + a share button (EVENT_PAGE.md §5). */
export function CardActions({ eventId, initial }: { eventId: string; initial: string | null }) {
  const [status, set] = useRsvp(eventId, initial);
  const toast = useToast();
  const on = status === "interested" || status === "going";
  return (
    <div className="mt-3 flex gap-2">
      <Button className="flex-1" variant={on ? "on" : "secondary"} aria-pressed={on} icon={status === "going" ? <Check size={16} /> : <Star size={16} fill={on ? "currentColor" : "none"} />} onClick={() => set(status === "going" ? "going" : "interested")}>
        {status === "going" ? "Going" : "Interested"}
      </Button>
      <Button aria-label="Share" className={cn("w-11 px-0")} onClick={() => toast("Sharing is off in this prototype.")}>
        <Share2 size={16} />
      </Button>
    </div>
  );
}

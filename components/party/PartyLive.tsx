"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useLiveEvents } from "@/components/live/LiveProvider";

const WATCH = new Set(["party.forming", "table.message", "plan.unavailable", "plan.locked", "match.found", "pair.message", "agent.verdict", "member.arrived"]);

/** Re-render the server view when the party changes. Debounced. */
export function PartyLive() {
  const router = useRouter();
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((e) => {
    if (!WATCH.has(e.type)) return;
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => router.refresh(), 120);
  });
  return null;
}

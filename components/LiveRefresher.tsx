"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLiveEvents } from "./useLiveEvents";

/** Server-rendered pages go stale in the client router cache; refresh (debounced) when the world changes. */
export function LiveRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const polls = useRef(0);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useLiveEvents(["party", "friends", "chat-archived", "demo", "posts"], (topic, data) => {
    const type = (data as { type?: string })?.type;
    if (topic === "demo" && type !== "reset" && type !== "fast-forward") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250); // trailing: bursts → one refresh after the last event
  }, () => {
    // polling fallback: refresh server-rendered pages every ~10s (4 × 2.5s) rather than every tick
    polls.current = (polls.current + 1) % 4;
    if (polls.current === 0) router.refresh();
  });
  return null;
}

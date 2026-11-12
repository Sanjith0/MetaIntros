"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLiveEvents } from "./useLiveEvents";

/** Server-rendered pages go stale in the client router cache; refresh (debounced) when the world changes. */
export function LiveRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useLiveEvents(["party", "friends", "chat-archived", "demo"], (topic, data) => {
    const type = (data as { type?: string })?.type;
    if (topic === "demo" && type !== "reset" && type !== "fast-forward") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250); // trailing: bursts → one refresh after the last event
  });
  return null;
}

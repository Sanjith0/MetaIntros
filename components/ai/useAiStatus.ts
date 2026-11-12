"use client";

import { useEffect, useState } from "react";
import type { AiStatus } from "@/lib/ai/status";

/** One shared poller per tab, so many badges on a page cost one request. */
const POLL_MS = 3_000;
let current: AiStatus | null = null;
const subs = new Set<(s: AiStatus | null) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    const r = await fetch("/api/ai/status", { cache: "no-store" });
    if (!r.ok) return;
    current = (await r.json()) as AiStatus;
    subs.forEach((f) => f(current));
  } catch {
    /* keep last known state */
  }
}

export function useAiStatus(): AiStatus | null {
  const [s, setS] = useState<AiStatus | null>(current);
  useEffect(() => {
    subs.add(setS);
    if (!timer) {
      load();
      timer = setInterval(load, POLL_MS);
    }
    return () => {
      subs.delete(setS);
      if (!subs.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return s;
}

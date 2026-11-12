"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribe to server-sent events on /api/stream. Handlers fire for the listed topics.
 * (The stream endpoint lands in Part 4; until then this silently no-ops on error.)
 */
export function useLiveEvents(topics: string[], onEvent: (topic: string, data: unknown) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const key = topics.join(",");
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/stream?topics=${encodeURIComponent(key)}`);
    const listeners = key.split(",").map((t) => {
      const fn = (e: MessageEvent) => {
        let data: unknown = null;
        try {
          data = JSON.parse(e.data);
        } catch {}
        handler.current(t, data);
      };
      es.addEventListener(t, fn);
      return [t, fn] as const;
    });
    es.onerror = () => {};
    return () => {
      listeners.forEach(([t, fn]) => es.removeEventListener(t, fn));
      es.close();
    };
  }, [key]);
}

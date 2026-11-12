"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PQEvent } from "@/contracts";

type Handler = (e: PQEvent) => void;
interface Live {
  viewerId: string;
  connected: boolean;
  subscribe: (fn: Handler) => () => void;
}

const LiveCtx = createContext<Live | null>(null);

/** One EventSource per page. Pages and the toaster subscribe to it. */
export function LiveProvider({ viewerId, stage = false, children }: { viewerId: string; stage?: boolean; children: React.ReactNode }) {
  const handlers = useRef(new Set<Handler>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(stage ? "/api/stream?stage=1" : "/api/stream");
    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("pq", (msg) => {
      const e = JSON.parse((msg as MessageEvent).data) as PQEvent;
      handlers.current.forEach((h) => h(e));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [viewerId, stage]);

  const subscribe = useCallback((fn: Handler) => {
    handlers.current.add(fn);
    return () => {
      handlers.current.delete(fn);
    };
  }, []);

  return (
    <LiveCtx.Provider value={{ viewerId, connected, subscribe }}>
      <div data-live={connected ? "on" : "off"} className="contents">
        {children}
      </div>
    </LiveCtx.Provider>
  );
}

export function useLive(): Live {
  const v = useContext(LiveCtx);
  if (!v) throw new Error("useLive outside LiveProvider");
  return v;
}

/** Subscribe to live events for the lifetime of a component. */
export function useLiveEvents(fn: Handler) {
  const { subscribe } = useLive();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}

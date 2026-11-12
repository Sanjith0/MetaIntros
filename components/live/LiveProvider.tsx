"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PQEvent } from "@/contracts";
import { unlockAudio } from "./sound";

type Handler = (e: PQEvent) => void;
interface Live {
  viewerId: string;
  connected: boolean;
  subscribe: (fn: Handler) => () => void;
  /** The server's clock, estimated from the stream's hello. Phones' clocks drift. */
  serverNow: () => number;
}

const LiveCtx = createContext<Live | null>(null);

/** One EventSource per page. Pages and the toaster subscribe to it. */
export function LiveProvider({ viewerId, stage = false, children }: { viewerId: string; stage?: boolean; children: React.ReactNode }) {
  const handlers = useRef(new Set<Handler>());
  const [connected, setConnected] = useState(false);
  const offset = useRef(0);
  const pathname = usePathname() ?? "";
  // Operator screens (the projector and the phones board) watch without counting as a phone.
  const observer = pathname.startsWith("/phones") || pathname.startsWith("/stage") || pathname.startsWith("/demo");

  // Phones only play sound after a tap; unlock audio on the first one.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(stage ? "/api/stream?stage=1" : observer ? "/api/stream?observer=1" : "/api/stream");
    es.addEventListener("hello", (msg) => {
      const sent = Date.now();
      try {
        const now = (JSON.parse((msg as MessageEvent).data) as { now?: number }).now;
        if (typeof now === "number") offset.current = now - sent;
      } catch {}
      setConnected(true);
    });
    es.addEventListener("pq", (msg) => {
      const e = JSON.parse((msg as MessageEvent).data) as PQEvent;
      handlers.current.forEach((h) => h(e));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [viewerId, stage, observer]);

  const subscribe = useCallback((fn: Handler) => {
    handlers.current.add(fn);
    return () => {
      handlers.current.delete(fn);
    };
  }, []);

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return (
    <LiveCtx.Provider value={{ viewerId, connected, subscribe, serverNow }}>
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

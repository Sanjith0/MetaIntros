"use client";

import { useEffect, useRef } from "react";

/**
 * One shared EventSource per tab (browsers allow only ~6 HTTP/1.1 connections per host, so
 * per-component streams would starve normal fetches). Components subscribe to topics on it.
 */
type Handler = (topic: string, data: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
let es: EventSource | null = null;
const attached = new Set<string>();

function ensureSource() {
  if (es || typeof EventSource === "undefined") return es;
  es = new EventSource("/api/stream");
  es.onerror = () => {};
  attached.clear();
  return es;
}

function attach(topic: string) {
  const src = ensureSource();
  if (!src || attached.has(topic)) return;
  attached.add(topic);
  src.addEventListener(topic, (e) => {
    let data: unknown = null;
    try {
      data = JSON.parse((e as MessageEvent).data);
    } catch {}
    for (const h of handlers.get(topic) ?? []) h(topic, data);
  });
}

export function useLiveEvents(topics: string[], onEvent: Handler) {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  const key = topics.join(",");
  useEffect(() => {
    const h: Handler = (t, d) => ref.current(t, d);
    const ts = key.split(",").filter(Boolean);
    for (const t of ts) {
      if (!handlers.has(t)) handlers.set(t, new Set());
      handlers.get(t)!.add(h);
      attach(t);
    }
    return () => {
      for (const t of ts) handlers.get(t)?.delete(h);
    };
  }, [key]);
}

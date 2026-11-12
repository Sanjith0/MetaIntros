"use client";

import { useEffect, useRef } from "react";

/**
 * One shared EventSource per tab (browsers allow only ~6 HTTP/1.1 connections per host, so
 * per-component streams would starve normal fetches). Components subscribe to topics on it.
 *
 * Degraded mode: some proxies/tunnels (seen with Cloudflare quick tunnels) buffer SSE so nothing
 * arrives. The server sends a `hello` on connect and a `ping` every 5s; if neither shows up in
 * time, this tab switches to polling — every subscriber's `onPoll` runs every POLL_MS — while still
 * handling any stream events that do get through (subscribers de-duplicate).
 */
type Handler = (topic: string, data: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
const pollers = new Set<() => void>();
let es: EventSource | null = null;
const attached = new Set<string>();

const HELLO_TIMEOUT_MS = 4_000;
const SILENCE_MS = 12_000;
const POLL_MS = 2_500;
let lastAlive = 0;
let degraded = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (degraded) return;
  degraded = true;
  document.documentElement.dataset.live = "polling";
  pollTimer = setInterval(() => pollers.forEach((p) => p()), POLL_MS);
}

function stopPolling() {
  if (!degraded) return;
  degraded = false;
  document.documentElement.dataset.live = "stream";
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function ensureSource() {
  if (es || typeof EventSource === "undefined") return es;
  es = new EventSource("/api/stream");
  es.onerror = () => {};
  attached.clear();
  const alive = () => {
    lastAlive = Date.now();
    if (!document.documentElement.dataset.live) document.documentElement.dataset.live = "stream";
  };
  es.addEventListener("hello", alive);
  es.addEventListener("ping", () => {
    alive();
    stopPolling(); // pings arriving on time again → the stream is healthy
  });
  const opened = Date.now();
  setInterval(() => {
    const silentFor = Date.now() - (lastAlive || opened);
    if (silentFor > (lastAlive ? SILENCE_MS : HELLO_TIMEOUT_MS)) startPolling();
  }, 1_000);
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

/**
 * Subscribe to live topics. `onPoll` (optional) re-fetches this component's state; it only runs
 * when the stream is degraded. Without it, the component simply relies on the stream.
 */
export function useLiveEvents(topics: string[], onEvent: Handler, onPoll?: () => void) {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  const pollRef = useRef(onPoll);
  pollRef.current = onPoll;
  const key = topics.join(",");
  const hasPoll = Boolean(onPoll);
  useEffect(() => {
    const h: Handler = (t, d) => ref.current(t, d);
    const ts = key.split(",").filter(Boolean);
    for (const t of ts) {
      if (!handlers.has(t)) handlers.set(t, new Set());
      handlers.get(t)!.add(h);
      attach(t);
    }
    const p = () => pollRef.current?.();
    if (hasPoll) pollers.add(p);
    return () => {
      for (const t of ts) handlers.get(t)?.delete(h);
      pollers.delete(p);
    };
  }, [key, hasPoll]);
}

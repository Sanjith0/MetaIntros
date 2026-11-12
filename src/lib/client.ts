"use client";
import type { QueueFilters } from "@/lib/types";

export const DEFAULT_FILTERS: QueueFilters = { womenOnly: false, ageBand: null, crewSize: 6 };

export function loadFilters(eventId: string): QueueFilters {
  try {
    const raw = sessionStorage.getItem(`filters:${eventId}`);
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_FILTERS;
}

export function saveFilters(eventId: string, f: QueueFilters) {
  try {
    sessionStorage.setItem(`filters:${eventId}`, JSON.stringify(f));
  } catch {}
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

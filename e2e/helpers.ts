import type { APIRequestContext } from "@playwright/test";
import type { CrewView, FormStep, QueueFilters } from "../src/lib/types";

export const ME = "maya";
export const EVENT = "pale-hour";
export const filters = (f: Partial<QueueFilters> = {}): QueueFilters => ({ womenOnly: false, ageBand: null, crewSize: 6, ...f });

export async function formCrew(request: APIRequestContext, f: QueueFilters, userId = ME) {
  await request.post("/api/reset");
  await request.post("/api/queue/join", { data: { eventId: EVENT, userId, filters: f } });
  await request.post("/api/demo/fill", { data: { eventId: EVENT, spacingMs: 1 } });
  await new Promise((r) => setTimeout(r, 100));
  const res = await request.post("/api/crew/form", { data: { eventId: EVENT, userId, filters: f } });
  const steps = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as FormStep);
  const last = steps[steps.length - 1];
  const crew = last.type === "crew" ? last.crew : null;
  return { steps, crew };
}

export async function getCrew(request: APIRequestContext, id: string) {
  return (await (await request.get(`/api/crew/${id}`)).json()) as CrewView;
}

export async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() - t0 > ms) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
}

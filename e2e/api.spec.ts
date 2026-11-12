import { expect, test } from "@playwright/test";
import { PROFILES } from "../src/data/seed";
import { evidenceList } from "../src/lib/signals";
import type { CrewView, Icebreaker } from "../src/lib/types";
import { EVENT, ME, filters, formCrew, getCrew, until } from "./helpers";

const P = (id: string) => PROFILES.find((p) => p.id === id)!;

test.describe("API flows (mock AI)", () => {
  test("health reports mock mode", async ({ request }) => {
    const h = await (await request.get("/api/health")).json();
    expect(h).toMatchObject({ ok: true, ai: "mock" });
  });

  test("queue: join puts Maya in the South Congress bucket, demo fill grows it", async ({ request }) => {
    await request.post("/api/reset");
    const before = await (await request.get(`/api/queue/status?eventId=${EVENT}&userId=${ME}`)).json();
    expect(before.bucket.id).toBe("soco");
    expect(before.inQueue).toBe(false);
    const t = await (await request.post("/api/queue/join", { data: { eventId: EVENT, userId: ME, filters: filters() } })).json();
    expect(t.bucketId).toBe("soco");
    await request.post("/api/demo/fill", { data: { eventId: EVENT, spacingMs: 20 } });
    const after = await until(
      async () => (await request.get(`/api/queue/status?eventId=${EVENT}&userId=${ME}`)).json(),
      (s) => s.nearby.length >= 15,
    );
    expect(after.inQueue).toBe(true);
    expect(after.nearby.length).toBe(15);
    expect(after.nearby.every((n: { id: string }) => !n.id.startsWith("x"))).toBe(true); // other buckets excluded
  });

  test("formation streams steps in order and returns a valid 6-person crew", async ({ request }) => {
    const { steps, crew } = await formCrew(request, filters());
    const ids = steps.filter((s) => s.type === "step").map((s) => (s as { id: string }).id);
    expect(ids.slice(0, 3)).toEqual(["scan", "filter", "shortlist"]);
    expect(ids).toContain("locked");
    expect(ids).toContain("venue");
    expect(crew).not.toBeNull();
    expect(crew!.memberIds).toHaveLength(6);
    expect(new Set(crew!.memberIds).size).toBe(6);
    expect(crew!.memberIds[0]).toBe(ME);
    expect(crew!.aiMode).toBe("fallback");
  });

  test("chemistry check swaps out a member who can't make the meetup", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    expect(crew!.swaps.length).toBeGreaterThan(0);
    expect(crew!.swaps[0].out).toBe("jordan");
    expect(crew!.memberIds).not.toContain("jordan");
    for (const id of crew!.memberIds) expect(P(id).freeFrom <= crew!.plan.time).toBe(true);
  });

  test("women & non-binary filter excludes men", async ({ request }) => {
    const { crew } = await formCrew(request, filters({ womenOnly: true }));
    for (const id of crew!.memberIds) expect(P(id).gender).not.toBe("man");
  });

  test("age band filter keeps everyone within ±4 years", async ({ request }) => {
    const { crew } = await formCrew(request, filters({ ageBand: 4 }));
    for (const id of crew!.memberIds) expect(Math.abs(P(id).age - P(ME).age)).toBeLessThanOrEqual(4);
  });

  test("crew size 8 is honored", async ({ request }) => {
    const { crew } = await formCrew(request, filters({ crewSize: 8 }));
    expect(crew!.memberIds).toHaveLength(8);
  });

  test("not enough people → error step, no crew", async ({ request }) => {
    await request.post("/api/reset");
    const f = filters({ womenOnly: true, ageBand: 1 });
    await request.post("/api/queue/join", { data: { eventId: EVENT, userId: ME, filters: f } });
    const res = await request.post("/api/crew/form", { data: { eventId: EVENT, userId: ME, filters: f } });
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.at(-1).type).toBe("error");
  });

  test("forming twice returns the same crew", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    const res = await request.post("/api/crew/form", { data: { eventId: EVENT, userId: ME, filters: filters() } });
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(lines[0].crew.id).toBe(crew!.id);
  });

  test("meetup plan: real venue, within everyone's window, before the show", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    expect(crew!.plan.venueId).toMatch(/^v-/);
    expect(crew!.plan.time >= "18:00" && crew!.plan.time <= "19:15").toBe(true);
    expect(crew!.plan.reasons.length).toBeGreaterThanOrEqual(3);
  });

  test("accept cascades to everyone, then the chat kicks off", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    const v = (await (await request.post(`/api/crew/${crew!.id}/accept`, { data: { userId: ME } })).json()) as CrewView;
    expect(v.accepted).toEqual([ME]);
    expect(v.allAccepted).toBe(false);
    const done = await until(() => getCrew(request, crew!.id), (c) => c.allAccepted && c.chat.length >= 2);
    expect(done.allAccepted).toBe(true);
    expect(done.chat[0].authorId).toBe("assistant");
    expect(done.chat.slice(1).every((m) => m.simulated)).toBe(true);
  });

  test("icebreakers: one card per crewmate, every hook cites shared evidence", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    const cards = (await (await request.get(`/api/crew/${crew!.id}/icebreakers?userId=${ME}`)).json()) as Icebreaker[];
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.hooks.length).toBeGreaterThanOrEqual(1);
      const allowed = evidenceList(P(ME), P(c.toId));
      for (const h of c.hooks) expect(allowed).toContain(h.evidence);
      expect(c.opener.length).toBeGreaterThan(5);
    }
    const priya = cards.find((c) => c.toId === "priya")!;
    expect(priya.mutualFriends).toContain("Sam Okafor");
  });

  test("chat: user message is stored and a simulated crewmate replies", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    await request.post(`/api/crew/${crew!.id}/accept`, { data: { userId: ME } });
    await request.post(`/api/crew/${crew!.id}/chat`, { data: { userId: ME, text: "see you at 6:30!" } });
    const c = await until(() => getCrew(request, crew!.id), (x) => x.chat.some((m) => m.authorId !== ME && m.id.startsWith("r-")));
    expect(c.chat.some((m) => m.authorId === ME && m.text === "see you at 6:30!")).toBe(true);
    expect(c.chat.some((m) => m.id.startsWith("r-") && m.simulated)).toBe(true);
  });

  test("check-in cascades arrivals", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    await request.post(`/api/crew/${crew!.id}/arrive`, { data: { userId: ME } });
    const c = await until(() => getCrew(request, crew!.id), (x) => x.arrived.length === 6);
    expect(c.arrived).toHaveLength(6);
  });

  test("crews list shows Maya's crew", async ({ request }) => {
    const { crew } = await formCrew(request, filters());
    const list = (await (await request.get(`/api/crews?userId=${ME}`)).json()) as CrewView[];
    expect(list.map((c) => c.id)).toEqual([crew!.id]);
  });

  test("unknown crew → 404", async ({ request }) => {
    expect((await request.get("/api/crew/nope")).status()).toBe(404);
  });
});

test("agent pre-chat: one grounded transcript per crewmate", async ({ request }) => {
  const { crew } = await formCrew(request, filters());
  const chats = (await (await request.get(`/api/crew/${crew!.id}/prechat?userId=${ME}`)).json()) as {
    bId: string; turns: { speaker: string }[]; topics: string[]; spark: number; summary: string;
  }[];
  expect(chats).toHaveLength(5);
  for (const c of chats) {
    expect(c.turns.length).toBeGreaterThanOrEqual(3);
    expect(c.turns[0].speaker).toBe("a");
    expect(c.spark).toBeGreaterThanOrEqual(1);
    expect(c.spark).toBeLessThanOrEqual(5);
    expect(c.summary.length).toBeGreaterThan(5);
  }
});

test("leaving: a crewmate leaving shrinks the crew; the seeker leaving dissolves it", async ({ request }) => {
  const { crew } = await formCrew(request, filters());
  const after = (await (await request.post(`/api/crew/${crew!.id}/leave`, { data: { userId: "priya" } })).json()) as CrewView;
  expect(after.memberIds).not.toContain("priya");
  expect(after.memberIds).toHaveLength(5);
  const gone = await (await request.post(`/api/crew/${crew!.id}/leave`, { data: { userId: ME } })).json();
  expect(gone.dissolved).toBe(true);
  expect((await request.get(`/api/crew/${crew!.id}`)).status()).toBe(404);
});

test("chat ignores messages from non-members", async ({ request }) => {
  const { crew } = await formCrew(request, filters());
  const v = (await (await request.post(`/api/crew/${crew!.id}/chat`, { data: { userId: "ethan", text: "hi" } })).json()) as CrewView;
  expect(v.chat.some((m) => m.authorId === "ethan")).toBe(false);
});

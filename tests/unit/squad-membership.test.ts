import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";
import { getQueueStatus, joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { acceptParty } from "@/lib/server/readyCheck";
import { leaveSquad, listActiveSquads, squadEventIds } from "@/lib/server/squads";
import { getPartyForUser } from "@/lib/server/party";
import { getChatForUser } from "@/lib/server/chats";
import { sweepExpiredChats } from "@/lib/server/expiry";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Jordan (p01, the only real person) queues, the simulated room fills, and one tick proposes a squad. */
async function proposeSquad(mode: "events" | "hangout" = "events") {
  const r = await joinQueue("p01", { mode, eventId: mode === "events" ? "ev-indie-guild" : null, targetSize: 4, landmarkId: "lm-downtown-pa", locationSource: "manual" });
  expect(r.ok).toBe(true);
  await wait(300);
  expect(await tick()).toBe(1);
  return prisma.party.findFirstOrThrow({ where: { status: "confirming" }, include: { event: true } });
}

async function confirmedSquad(mode: "events" | "hangout" = "events") {
  const p = await proposeSquad(mode);
  expect(await acceptParty("p01", p.id)).toMatchObject({ ok: true, status: "confirmed" });
  return prisma.party.findUniqueOrThrow({ where: { id: p.id }, include: { chat: true, event: true, members: true } });
}

describe("being in more than one squad, and leaving one", () => {
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
  });

  it("you can queue again while in a squad, and both squads are listed, soonest first", async () => {
    const first = await confirmedSquad("events");
    const second = await confirmedSquad("hangout");
    expect(second.event?.kind).toBe("hangout");
    const squads = await listActiveSquads("p01");
    expect(squads.map((s) => s.partyId).sort()).toEqual([first.id, second.id].sort());
    expect(squads.find((s) => s.partyId === second.id)).toMatchObject({ hangout: true, chatId: second.chat!.id });
    expect(squads.find((s) => s.partyId === first.id)).toMatchObject({ hangout: false, chatId: first.chat!.id });
    expect(squads.every((s) => !s.faces.some((f) => f.id === "p01"))).toBe(true);
    const starts = squads.map((s) => s.startsAt);
    expect([...starts].sort()).toEqual(starts);
  });

  it("leaving a squad takes you out of its members, chat and plan; the others see one line", async () => {
    const party = await confirmedSquad();
    const chatId = party.chat!.id;
    expect(await leaveSquad("p01", party.id)).toEqual({ ok: true });
    expect(await prisma.partyMember.count({ where: { partyId: party.id, userId: "p01" } })).toBe(0);
    expect(await prisma.partyMember.count({ where: { partyId: party.id } })).toBe(party.members.length - 1);
    expect(await getPartyForUser("p01", party.id)).toBeNull();
    expect(await getChatForUser("p01", chatId)).toBeNull();
    expect(await listActiveSquads("p01")).toEqual([]);
    expect((await squadEventIds("p01")).size).toBe(0);
    expect((await getQueueStatus("p01")).state).toBe("idle");
    const last = await prisma.chatMessage.findFirstOrThrow({ where: { chatId }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ kind: "system", body: "Jordan left the squad." });
    // the squad itself carries on for everyone else
    expect((await prisma.party.findUniqueOrThrow({ where: { id: party.id } })).status).toBe("confirmed");
    // leaving twice, or a squad you were never in, is a 404
    expect(await leaveSquad("p01", party.id)).toEqual({ ok: false, error: "not_found" });
  });

  it("leaving one squad keeps the other", async () => {
    const a = await confirmedSquad("events");
    const b = await confirmedSquad("hangout");
    expect(await leaveSquad("p01", a.id)).toEqual({ ok: true });
    expect((await listActiveSquads("p01")).map((s) => s.partyId)).toEqual([b.id]);
  });

  it("during the ready check, and after the chat has ended, there's nothing to leave", async () => {
    const proposed = await proposeSquad();
    expect(await leaveSquad("p01", proposed.id)).toEqual({ ok: false, error: "not_open" }); // "Not for me" does this
    await acceptParty("p01", proposed.id);
    await sweepExpiredChats(new Date(proposed.event!.endsAt.getTime() + 25 * 3600_000));
    expect(await leaveSquad("p01", proposed.id)).toEqual({ ok: false, error: "not_open" });
    expect(await listActiveSquads("p01")).toEqual([]);
  });
});

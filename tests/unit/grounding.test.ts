import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { seedDatabase } from "@/lib/seed/seed";
import { joinQueue, tick } from "@/lib/server/queue";
import { setSetting } from "@/lib/server/settings";
import { createSampleLiveUser } from "@/lib/server/signup";
import { isSensitiveText, resolveSource, validateCard, type CardContent, type CardSubject } from "@/lib/cards/claims";
import { loadPeople } from "@/lib/profile/load";
import { generateTalkCards } from "@/lib/server/talkCards";
import { VOCAB } from "@/lib/graph/vocabulary";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SENSITIVE_NAMES = VOCAB.filter((v) => v.sensitive).flatMap((v) => [...v.pages, ...(v.groups ?? [])]);

async function subjectsFor(partyId: string) {
  const ids = (await prisma.partyMember.findMany({ where: { partyId } })).map((m) => m.userId);
  const people = await loadPeople(prisma, ids);
  return new Map<string, CardSubject>([...people.values()].map((p) => [p.id, { id: p.id, name: p.name, profile: p.profile, friends: p.friends }]));
}

describe("talk card grounding & privacy", () => {
  beforeAll(async () => {
    mockProvider().reset();
    // A hostile model: tries sensitive openers on every card.
    mockProvider().on("talk_cards", (req) => {
      const { pairs } = JSON.parse(req.messages[1].content);
      return JSON.stringify({
        pairs: pairs.map((p: { owner: string; subject: string }) => ({
          owner: p.owner, subject: p.subject,
          openers: ["Do you go to church on Sundays?", "Which way did you vote?", "What got you into climbing?"],
        })),
      });
    });
    await seedDatabase(prisma, { now: new Date() });
    await setSetting("simFillMs", "0");
    // several parties, including personas with planted sensitive likes (p03, p06 …)
    await joinQueue("p01", { eventId: "ev-indie-guild", targetSize: 8, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    for (const [i, ev] of ["ev-board-game-night", "ev-farmers-market"].entries()) {
      const u = await createSampleLiveUser(prisma, { name: `Live ${i}`, ageBand: "18-24", gender: null, womenOnlyParty: false });
      await joinQueue(u.userId, { eventId: ev, targetSize: 4, landmarkId: "lm-cal-ave", locationSource: "manual" });
    }
    await wait(500);
    await tick();
    // plus a squad that definitely contains the planted sensitive personas p03 + p06
    const party = await prisma.party.create({
      data: { landmarkId: "lm-downtown-pa", targetSize: 4, ageBand: "18-24", status: "confirmed", eventId: "ev-vinyl-swap",
        members: { create: ["p01", "p03", "p05", "p06"].map((userId) => ({ userId })) } },
    });
    sensitivePartyId = party.id;
    await generateTalkCards(party.id);
  });
  let sensitivePartyId = "";

  it("100% of stored claims cite sources that resolve to real profile fields", async () => {
    const parties = await prisma.party.findMany({ where: { status: "confirmed" } });
    expect(parties.length).toBeGreaterThanOrEqual(2);
    let total = 0;
    for (const p of parties) {
      const subjects = await subjectsFor(p.id);
      for (const card of await prisma.talkCard.findMany({ where: { partyId: p.id } })) {
        const c = card.content as unknown as CardContent;
        for (const claim of c.claims) {
          total++;
          expect(claim.sources.length).toBeGreaterThan(0);
          for (const s of claim.sources) if (!s.startsWith("preChat:")) expect(resolveSource(s, subjects).ok, s).toBe(true);
        }
      }
    }
    expect(total).toBeGreaterThan(50);
  });

  it("no sensitive-category claim or opener survives (politics, religion, health, sexuality)", async () => {
    const subjects = await subjectsFor(sensitivePartyId);
    expect([...subjects.values()].some((s) => [...s.profile.likes, ...s.profile.groups].some((x) => x.sensitive))).toBe(true);
    const cards = await prisma.talkCard.findMany();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const c = card.content as unknown as CardContent;
      const text = [...c.claims.map((x) => x.text), ...c.openers].join("\n");
      expect(isSensitiveText(text), text).toBe(false);
      for (const n of SENSITIVE_NAMES) expect(text).not.toContain(n);
      expect(c.openers).toContain("What got you into climbing?");
      expect(c.stripped).toBeGreaterThanOrEqual(2);
    }
  });

  it("validateCard strips unsourced, forged and sensitive-sourced claims", async () => {
    const subjects = await subjectsFor(sensitivePartyId);
    const sensitivePerson = [...subjects.values()].find((s) => s.profile.likes.some((l) => l.sensitive))!;
    const idx = sensitivePerson.profile.likes.findIndex((l) => l.sensitive);
    const card: CardContent = {
      generatedBy: "model",
      openers: ["Great to meet you!"],
      claims: [
        { kind: "shared_interest", text: "You both like climbing.", sources: [] },
        { kind: "shared_interest", text: "You both like climbing.", sources: [`${sensitivePerson.id}:likes[999]`] },
        { kind: "shared_interest", text: "You both like climbing.", sources: ["nobody:likes[0]"] },
        { kind: "shared_interest", text: "You share a community.", sources: [`${sensitivePerson.id}:likes[${idx}]`] },
        { kind: "pattern", text: "You're both on the same side politically.", sources: ["mutualFriends"] },
        { kind: "mutual_friends", text: "2 mutual friends", sources: ["mutualFriends"] },
      ],
    };
    const v = validateCard(card, subjects);
    expect(v.claims.map((c) => c.text)).toEqual(["2 mutual friends"]);
    expect(v.stripped).toBe(5);
  });
});

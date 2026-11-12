import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import { buildClaims, templateOpeners, validateCard, type CardContent, type CardSubject, type Claim } from "@/lib/cards/claims";
import { writeOpeners, type PairInput } from "@/lib/agents/talkCards";
import { loadPeople } from "@/lib/profile/load";
import { writeTrace } from "./trace";

/** Generate one card per (owner, subject) pair in the party. Idempotent (upsert). */
export async function generateTalkCards(partyId: string) {
  const members = await prisma.partyMember.findMany({ where: { partyId }, select: { userId: true } });
  const ids = members.map((m) => m.userId);
  const people = await loadPeople(prisma, ids);
  const subjects = new Map<string, CardSubject>([...people.values()].map((p) => [p.id, { id: p.id, name: p.name, profile: p.profile, friends: p.friends }]));
  const friendIds = [...new Set([...people.values()].flatMap((p) => [...p.friends]))];
  const names = new Map((await prisma.user.findMany({ where: { id: { in: friendIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const nameOf = (id: string) => names.get(id) ?? "a friend";

  const sparks = await prisma.preChat.findMany({ where: { partyId } });
  const sparkClaims = (a: string, b: string): Claim[] => {
    const pc = sparks.find((s) => (s.userAId === a && s.userBId === b) || (s.userAId === b && s.userBId === a));
    return pc ? (pc.sparks as string[]).slice(0, 1).map((t) => ({ kind: "spark" as const, text: `Conversation spark (from your Companions' AI conversation): ${t}`, sources: [`preChat:${pc.id}`] })) : [];
  };

  const pairs: PairInput[] = [];
  for (const a of ids) for (const b of ids) {
    if (a === b || !subjects.has(a) || !subjects.has(b)) continue;
    pairs.push({ owner: a, subject: b, subjectFirstName: subjects.get(b)!.name.split(" ")[0], claims: [...buildClaims(subjects.get(a)!, subjects.get(b)!, nameOf), ...sparkClaims(a, b)] });
  }
  const tpl = (p: PairInput) => templateOpeners(subjects.get(p.owner)!, subjects.get(p.subject)!, p.claims);
  const { openers, source } = await writeOpeners(pairs, tpl);

  let stripped = 0;
  for (const p of pairs) {
    const raw: CardContent = { claims: p.claims, openers: openers(p), generatedBy: source === "fallback" ? "template" : "model" };
    let card = validateCard(raw, subjects);
    if (card.openers.length === 0) card = { ...card, openers: tpl(p) };
    stripped += card.stripped ?? 0;
    await prisma.talkCard.upsert({
      where: { partyId_ownerId_subjectId: { partyId, ownerId: p.owner, subjectId: p.subject } },
      create: { partyId, ownerId: p.owner, subjectId: p.subject, content: toJson(card) },
      update: { content: toJson(card) },
    });
  }
  await writeTrace(partyId, [
    { agent: "talk_cards", kind: "decision", output: { cards: pairs.length, source, stripped },
      summary: `Wrote ${pairs.length} talk cards; every claim cites its source field${stripped ? `, ${stripped} ungrounded/sensitive item(s) stripped` : ""}` },
  ]);
  return pairs.length;
}

export async function getTalkCards(partyId: string, ownerId: string) {
  const cards = await prisma.talkCard.findMany({
    where: { partyId, ownerId },
    include: { subject: { select: { id: true, name: true, avatarColor: true } } },
  });
  return cards.map((c) => ({ subject: c.subject, content: c.content as unknown as CardContent }));
}

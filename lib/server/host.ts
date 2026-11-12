import { prisma } from "@/lib/db";
import { generateReply, generateWelcome, MENTION_RE, stallNudge, type HostContext } from "@/lib/agents/host";
import { groupCohesion } from "@/lib/match/cohesion";
import { loadPeople } from "@/lib/profile/load";
import { fmtEventWhen } from "@/lib/format";
import { postMessage } from "./messages";
import { writeTrace } from "./trace";
import { getSetting } from "./settings";
import { label } from "@/lib/agents/describe";
import { nowMs } from "@/lib/clock";

export const MAX_HOST_REPLIES = 5;
export const MAX_NUDGES = 2;

export async function hostContext(chatId: string): Promise<HostContext | null> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: { party: { include: { event: true, members: true } } } });
  const party = chat?.party;
  if (!party?.event) return null;
  const people = await loadPeople(prisma, party.members.map((m) => m.userId));
  const members = party.members.map((m) => people.get(m.userId)!).filter(Boolean);
  const coh = members.length >= 2 ? groupCohesion(members) : null;
  return {
    eventTitle: party.event.title,
    when: fmtEventWhen(party.event.startsAt),
    meetingSpot: `the front entrance of ${party.event.venueName}`,
    memberNames: members.map((m) => m.name.split(" ")[0]),
    shared: coh?.sharedTags ?? [],
  };
}

/** Exactly one welcome per squad chat (idempotent). */
export async function postHostWelcome(partyId: string) {
  const chat = await prisma.chat.findUnique({ where: { partyId } });
  if (!chat) return;
  if (await prisma.chatMessage.count({ where: { chatId: chat.id, kind: "host" } })) return;
  const ctx = await hostContext(chat.id);
  if (!ctx) return;
  const w = await generateWelcome(ctx);
  // re-check after the (possibly slow) model call
  if (await prisma.chatMessage.count({ where: { chatId: chat.id, kind: "host" } })) return;
  await postMessage(chat.id, null, w.value.welcome, "host");
  await postMessage(chat.id, null, `Icebreaker: ${w.value.icebreaker}`, "host");
  await writeTrace(partyId, [
    { agent: "host", kind: "decision", output: { interestTag: w.value.interestTag, source: w.source }, summary: `Posted welcome + icebreaker about ${label(w.value.interestTag).toLowerCase() || "the weekend"} (shared by ${ctx.shared.find((s) => s.tag === w.value.interestTag)?.count ?? 0} members)` },
  ]);
  scheduleSimulatedBanter(chat.id, partyId).catch(() => {});
}

/** A couple of simulated squadmates answer the icebreaker so the demo chat feels alive (no model calls). */
async function scheduleSimulatedBanter(chatId: string, partyId: string) {
  if (process.env.NODE_ENV === "test") return;
  const delay = Number(await getSetting("banterDelayMs", "4000"));
  const members = await prisma.partyMember.findMany({ where: { partyId }, include: { user: { include: { tasteProfile: true } } } });
  const sims = members.filter((m) => m.user.isSimulated).slice(0, 2);
  const lines = (tag: string, i: number) =>
    [`omg ${tag} is my whole personality lately 😅 so in`, `honestly ${tag} is how I spend most weekends. excited to meet you all!`][i % 2];
  sims.forEach((m, i) => {
    const top = ((m.user.tasteProfile?.interestTags ?? []) as { tag: string }[])[0]?.tag;
    setTimeout(() => {
      postMessage(chatId, m.userId, lines(top ? label(top).toLowerCase() : "this", i)).catch(() => {});
    }, delay * (i + 1));
  });
}

/** Host speaks only when @mentioned (capped per chat). */
export async function afterUserMessage(chatId: string, _userId: string, body: string) {
  void _userId;
  if (!MENTION_RE.test(body)) return;
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || chat.type !== "squad" || chat.archived) return;
  const replies = await prisma.chatMessage.count({ where: { chatId, kind: "host" } });
  if (replies >= 2 + MAX_HOST_REPLIES) return;
  const ctx = await hostContext(chatId);
  if (!ctx) return;
  const recent = await prisma.chatMessage.findMany({ where: { chatId }, orderBy: { createdAt: "desc" }, take: 6, include: { sender: { select: { name: true } } } });
  const reply = await generateReply(ctx, recent.reverse().map((m) => ({ from: m.kind === "host" ? "host" : (m.sender?.name.split(" ")[0] ?? "system"), text: m.body })));
  await postMessage(chatId, null, reply, "host");
}

/** Nudge stalled squad chats (template, no model call). Run from the ticker. */
export async function checkStalls(now = nowMs()) {
  const stallMs = Number(await getSetting("stallMs", String(15 * 60_000)));
  const chats = await prisma.chat.findMany({ where: { type: "squad", archived: false, lastMessageAt: { lt: new Date(now - stallMs) } } });
  for (const c of chats) {
    const last = await prisma.chatMessage.findFirst({ where: { chatId: c.id }, orderBy: { createdAt: "desc" } });
    if (!last || last.kind === "host") continue;
    const nudges = await prisma.chatMessage.count({ where: { chatId: c.id, kind: "host", body: { startsWith: "Quiet in here" } } });
    if (nudges >= MAX_NUDGES) continue;
    const ctx = await hostContext(c.id);
    if (ctx) await postMessage(c.id, null, stallNudge(ctx, nudges), "host");
  }
}

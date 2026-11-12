import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import { runPreChat } from "@/lib/agents/companion";
import { loadPeople } from "@/lib/profile/load";
import { writeTrace } from "./trace";

export async function generatePreChats(partyId: string) {
  const ids = (await prisma.partyMember.findMany({ where: { partyId }, select: { userId: true } })).map((m) => m.userId).sort();
  const people = await loadPeople(prisma, ids);
  let modelCalls = 0, n = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = people.get(ids[i]), b = people.get(ids[j]);
      if (!a || !b) continue;
      const useModel = !a.isSimulated || !b.isSimulated;
      const r = await runPreChat(a, b, useModel);
      if (useModel) modelCalls++;
      await prisma.preChat.upsert({
        where: { partyId_userAId_userBId: { partyId, userAId: a.id, userBId: b.id } },
        create: { partyId, userAId: a.id, userBId: b.id, transcript: toJson(r.value.transcript), sparks: toJson(r.value.sparks), simulated: true },
        update: { transcript: toJson(r.value.transcript), sparks: toJson(r.value.sparks) },
      });
      n++;
    }
  }
  await writeTrace(partyId, [
    { agent: "companion", kind: "decision", output: { preChats: n, modelCalls },
      summary: `Companion agents ran ${n} simulated pre-chats (each saw only its two profiles) to find conversation sparks` },
  ]);
  return n;
}

export async function getPreChatsFor(partyId: string, ownerId: string) {
  const rows = await prisma.preChat.findMany({ where: { partyId, OR: [{ userAId: ownerId }, { userBId: ownerId }] } });
  return rows.map((r) => ({
    otherId: r.userAId === ownerId ? r.userBId : r.userAId,
    meIsA: r.userAId === ownerId,
    transcript: r.transcript as { speaker: "A" | "B"; text: string }[],
    sparks: r.sparks as string[],
    simulated: r.simulated,
  }));
}

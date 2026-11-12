import { simulatedReply } from "@/lib/icebreakers";
import { getCrew, view } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const { userId, text } = (await req.json()) as { userId: string; text: string };
  const clean = String(text ?? "").slice(0, 1000).trim();
  if (!clean || !c.memberIds.includes(userId)) return Response.json(view(c));
  c.chat.push({ id: `u-${Date.now()}`, authorId: userId, text: clean, at: Date.now() });
  // Simulated crewmate reply arrives asynchronously, like a real chat.
  void simulatedReply(c, clean).then((reply) => {
    if (reply) c.chat.push({ ...reply, at: Math.max(Date.now(), reply.at + 1200) });
  });
  return Response.json(view(c));
}

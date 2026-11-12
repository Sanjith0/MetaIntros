import { kickoffMessage, seededReplies } from "@/lib/icebreakers";
import { cascade, getCrew, view } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const { userId } = (await req.json()) as { userId: string };
  cascade(c.acceptAt, c, userId, Number(process.env.DEMO_ACCEPT_SPACING_MS ?? 500));
  if (!c.chat.length && !(c as { kicking?: boolean }).kicking) {
    (c as { kicking?: boolean }).kicking = true;
    const allIn = Math.max(...Object.values(c.acceptAt));
    // Don't block the accept on the model: the kickoff lands in the chat when ready.
    void kickoffMessage(c).then((kick) => {
      const at = Math.max(allIn + 300, Date.now());
      c.chat.push({ ...kick, at }, ...seededReplies(c).map((m, i) => ({ ...m, at: at + 1200 + i * 1400 })));
    });
  }
  return Response.json(view(c));
}

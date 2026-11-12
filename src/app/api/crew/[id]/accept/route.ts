import { kickoffMessage, seededReplies } from "@/lib/icebreakers";
import { cascade, getCrew, view } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const { userId } = (await req.json()) as { userId: string };
  cascade(c.acceptAt, c, userId, Number(process.env.DEMO_ACCEPT_SPACING_MS ?? 500));
  if (!c.chat.length) {
    const allIn = Math.max(...Object.values(c.acceptAt));
    const kick = await kickoffMessage(c);
    kick.at = allIn + 300;
    c.chat.push(kick, ...seededReplies(c).map((m, i) => ({ ...m, at: allIn + 1500 + i * 1400 })));
  }
  return Response.json(view(c));
}

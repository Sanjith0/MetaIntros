import { getCrew, state, view } from "@/lib/store";

// One-tap exit. The person disappears from the crew; if the seeker leaves, the crew dissolves for them.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const { userId } = (await req.json()) as { userId: string };
  if (userId === c.seekerId) {
    state().crews.delete(c.id);
    state().queue = state().queue.filter((q) => !(q.userId === userId && q.eventId === c.eventId));
    return Response.json({ dissolved: true });
  }
  c.memberIds = c.memberIds.filter((m) => m !== userId);
  delete c.acceptAt[userId];
  delete c.arriveAt[userId];
  c.chat.push({ id: `l-${Date.now()}`, authorId: "assistant", text: `Someone left the crew. No worries, the plan stays the same.`, at: Date.now() });
  return Response.json(view(c));
}

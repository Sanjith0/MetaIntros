import { icebreaker } from "@/lib/icebreakers";
import { getCrew } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const userId = new URL(req.url).searchParams.get("userId") ?? c.seekerId;
  const others = c.memberIds.filter((id) => id !== userId);
  const cards = await Promise.all(others.map((o) => icebreaker(userId, o)));
  return Response.json(cards);
}

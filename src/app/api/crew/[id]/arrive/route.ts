import { cascade, getCrew, view } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const { userId } = (await req.json()) as { userId: string };
  cascade(c.arriveAt, c, userId, Number(process.env.DEMO_ARRIVE_SPACING_MS ?? 1800));
  return Response.json(view(c));
}

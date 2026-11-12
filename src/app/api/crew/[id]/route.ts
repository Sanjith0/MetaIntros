import { getCrew, view } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCrew((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(view(c));
}

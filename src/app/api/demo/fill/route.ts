import { demoFill } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId, spacingMs } = (await req.json()) as { eventId: string; spacingMs?: number };
  demoFill(eventId, spacingMs ?? Number(process.env.DEMO_FILL_SPACING_MS ?? 450));
  return Response.json({ ok: true });
}

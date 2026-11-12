import { MODELS, museEnabled } from "@/lib/muse";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ai: museEnabled() ? "muse" : "mock", models: MODELS });
}

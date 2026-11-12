import { MODELS, museEnabled, museStats } from "@/lib/muse";

export const dynamic = "force-dynamic";

export async function GET() {
  const st = museStats();
  // "degraded" = live mode, but the most recent model call failed and the app fell back.
  const degraded = museEnabled() && st.lastFailAt != null && (st.lastOkAt == null || st.lastFailAt > st.lastOkAt);
  return Response.json({ ok: true, ai: museEnabled() ? "muse" : "mock", degraded, stats: st, models: MODELS });
}

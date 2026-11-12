import { resetState } from "@/lib/store";

export async function POST() {
  resetState();
  return Response.json({ ok: true });
}

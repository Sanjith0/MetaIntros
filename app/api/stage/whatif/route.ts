import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { store } from "@/lib/server/store";
import { whatIf, whatIfMembers } from "@/lib/server/whatif";

export const dynamic = "force-dynamic";

const partyOf = (id: string | null | undefined) => id || [...store().parties.keys()].at(-1) || "";

/** For the projector: each member's removable rules. */
export function GET(req: Request) {
  if (!flag("WHAT_IF")) return NextResponse.json({ error: "off" }, { status: 404 });
  return NextResponse.json({ members: whatIfMembers(partyOf(new URL(req.url).searchParams.get("party"))) });
}

/** Re-run the table in a sandbox without the chosen rules. Touches no live state. */
export async function POST(req: Request) {
  if (!flag("WHAT_IF")) return NextResponse.json({ error: "off" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { partyId?: string; remove?: { ownerId: string; ruleId: string }[] };
  const r = await whatIf(partyOf(body.partyId), Array.isArray(body.remove) ? body.remove.map((x) => ({ ownerId: String(x?.ownerId), ruleId: String(x?.ruleId) })) : []);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

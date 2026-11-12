import { NextResponse } from "next/server";
import { auditContext } from "@/lib/agents/audit";
import { flag } from "@/lib/flags";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** For the projector: the exact prompt one agent got in one round, with its audit. */
export function GET(req: Request) {
  if (!flag("CONTEXT_AUDIT")) return NextResponse.json({ error: "off" }, { status: 404 });
  const u = new URL(req.url);
  const party = u.searchParams.get("party") ?? "";
  const owner = u.searchParams.get("owner") ?? "";
  const round = u.searchParams.get("round") ?? "";
  const p = store().prompts.get(`${party}:${owner}:${round}`);
  if (!p) return NextResponse.json({ error: "no prompt recorded" }, { status: 404 });
  return NextResponse.json({ ...p, audit: auditContext(p.user, party, owner) });
}

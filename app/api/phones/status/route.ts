import { NextResponse } from "next/server";
import { DEMO_IDS } from "@/fixtures";
import { acksFor, connected } from "@/lib/server/phones";
import { store } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** For the /phones operator page: who is connected and when each phone showed MATCH FOUND. */
export function GET() {
  const s = store();
  const party = [...s.parties.values()].at(-1);
  const acks = party ? acksFor(party.id) : [];
  return NextResponse.json({
    partyStatus: party?.status ?? null,
    lockedAt: party?.lockedAt ?? null,
    phones: DEMO_IDS.map((id) => {
      const a = acks.find((x) => x.userId === id);
      return { id, connected: connected(id), lagMs: a?.lagMs ?? null, sound: a?.sound ?? null, vibrate: a?.vibrate ?? null };
    }),
  });
}

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/server/session";
import { squadConnectState } from "@/lib/server/friending";
import { SquadConnect } from "@/components/friends/SquadConnect";
import { albumParty } from "@/lib/server/album";
import { getShareChoice, shareOpen } from "@/lib/server/posts";
import { now } from "@/lib/server/clock";

export default async function ConnectPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const me = await getCurrentUserId();
  const s = await squadConnectState(me, partyId);
  if (!s) notFound();
  const [party, choice, at] = await Promise.all([albumParty(partyId, me), getShareChoice(partyId, me), now()]);
  return <SquadConnect initial={s} sharePrompt={Boolean(party && shareOpen(party, at) && !choice)} />;
}

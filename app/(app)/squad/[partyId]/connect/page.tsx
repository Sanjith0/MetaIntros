import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/server/session";
import { squadConnectState } from "@/lib/server/friending";
import { SquadConnect } from "@/components/friends/SquadConnect";

export default async function ConnectPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const s = await squadConnectState(await getCurrentUserId(), partyId);
  if (!s) notFound();
  return <SquadConnect initial={s} />;
}

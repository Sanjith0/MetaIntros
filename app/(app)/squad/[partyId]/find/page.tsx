import { notFound } from "next/navigation";
import { TopBar } from "@/components/fb/TopBar";
import { FindYourParty } from "@/components/chat/FindYourParty";
import { getPartyForUser, isRevealed } from "@/lib/server/party";
import { getCurrentUserId } from "@/lib/server/session";

export default async function FindPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const me = await getCurrentUserId();
  const p = await getPartyForUser(me, partyId);
  if (!p?.event || !isRevealed(p.status)) notFound();
  return (
    <div>
      <TopBar back={`/squad/${partyId}`} title="Find each other" />
      <FindYourParty partyId={partyId} meId={me} spot={`Front entrance, ${p.event.venueName}`} lat={p.event.lat} lng={p.event.lng} />
    </div>
  );
}

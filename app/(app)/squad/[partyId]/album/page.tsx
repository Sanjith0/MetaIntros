import { notFound } from "next/navigation";
import { SquadAlbum } from "@/components/album/SquadAlbum";
import { listAlbum } from "@/lib/server/album";
import { getCurrentUserId } from "@/lib/server/session";

/** The squad's shared album: members of a ready squad only. */
export default async function AlbumPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const album = await listAlbum(partyId, await getCurrentUserId());
  if (!album) notFound();
  return <SquadAlbum initial={album} />;
}

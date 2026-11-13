import { notFound } from "next/navigation";
import { getChatForUser, markChatRead } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { ChatThread } from "@/components/chat/ChatThread";
import { now } from "@/lib/server/clock";
import { getSquadHeader } from "@/lib/server/squadChat";
import { sweepExpiredChats } from "@/lib/server/expiry";
import { getRatingState } from "@/lib/server/ratings";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  await sweepExpiredChats();
  const chat = await getChatForUser(userId, id);
  if (!chat) notFound();
  await markChatRead(userId, id, await now());
  const squad = chat.type === "squad" ? await getSquadHeader(id) : null;
  const rating = chat.type === "squad" && chat.partyId ? await getRatingState(chat.partyId, userId) : null;
  return <ChatThread chat={JSON.parse(JSON.stringify(chat))} meId={userId} squad={squad} rating={rating} />;
}

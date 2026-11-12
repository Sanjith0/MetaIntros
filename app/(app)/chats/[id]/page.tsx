import { notFound } from "next/navigation";
import { getChatForUser, markChatRead } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { ChatThread } from "@/components/chat/ChatThread";
import { now } from "@/lib/server/clock";
import { getSquadHeader } from "@/lib/server/squadChat";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const chat = await getChatForUser(userId, id);
  if (!chat) notFound();
  await markChatRead(userId, id, new Date(Math.max(Date.now(), (await now()).getTime())));
  const squad = chat.type === "squad" ? await getSquadHeader(id) : null;
  return <ChatThread chat={JSON.parse(JSON.stringify(chat))} meId={userId} squad={squad} />;
}

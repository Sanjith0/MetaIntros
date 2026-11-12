import { prisma } from "@/lib/db";
import { publish } from "./bus";

export type PostResult = { ok: true; message: Awaited<ReturnType<typeof prisma.chatMessage.create>> } | { ok: false; error: "not_member" | "archived" | "empty" };

async function memberIds(chatId: string) {
  return (await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } })).map((m) => m.userId);
}

/** Post a message. Archived chats are read-only (enforced here, not just in the UI). */
export async function postMessage(chatId: string, senderId: string | null, body: string, kind: "user" | "host" | "system" = "user"): Promise<PostResult> {
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "empty" };
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return { ok: false, error: "not_member" };
  if (chat.archived && kind === "user") return { ok: false, error: "archived" };
  const members = await memberIds(chatId);
  if (senderId && !members.includes(senderId)) return { ok: false, error: "not_member" };
  const message = await prisma.chatMessage.create({ data: { chatId, senderId, kind, body: text } });
  await prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: message.createdAt } });
  if (senderId) await prisma.chatMember.updateMany({ where: { chatId, userId: senderId }, data: { lastReadAt: message.createdAt } });
  const sender = senderId ? await prisma.user.findUnique({ where: { id: senderId }, select: { id: true, name: true, avatarColor: true } }) : null;
  publish("chat", { chatId, message: { ...message, sender } }, members);
  publish("badges", {}, members.filter((m) => m !== senderId));
  return { ok: true, message };
}

export { memberIds };

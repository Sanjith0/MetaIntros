"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/Avatar";

interface U { id: string; name: string; avatarColor: string }
export interface ThreadChat {
  id: string;
  type: string;
  title: string | null;
  archived: boolean;
  members: { user: U }[];
  messages: { id: string; body: string; kind: string; createdAt: string; senderId: string | null; sender: U | null }[];
}

export function ChatThread({ chat, meId }: { chat: ThreadChat; meId: string }) {
  const others = chat.members.map((m) => m.user).filter((u) => u.id !== meId);
  const title = chat.type === "direct" ? others[0]?.name : chat.title;
  return (
    <div data-testid="chat-thread" className="flex min-h-[calc(100dvh-8rem)] flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-fb-divider px-3 py-2">
        <Link href="/chats" aria-label="Back"><ArrowLeft size={22} /></Link>
        <span className="font-semibold">{title}</span>
      </div>
      <ul className="flex-1 space-y-1.5 p-3" data-testid="messages">
        {chat.messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <li key={m.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : ""}`}>
              {!mine && m.sender && <Avatar name={m.sender.name} color={m.sender.avatarColor} size={26} />}
              <span className={`max-w-[75%] rounded-2xl px-3 py-1.5 ${mine ? "bg-fb-blue text-white" : "bg-[#e4e6eb]"}`}>{m.body}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

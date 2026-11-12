"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Lock, SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useLiveEvents } from "@/components/useLiveEvents";
import { SquadHeader, type SquadHeaderData } from "./SquadHeader";
import { ArchivedPrompt } from "./ArchivedPrompt";
import { FastForwardButton } from "./FastForwardButton";
import { FindYourParty } from "./FindYourParty";
import { AiSourceBadge } from "@/components/ai/AiBadges";

interface U { id: string; name: string; avatarColor: string }
export interface ThreadMessage { id: string; body: string; kind: string; createdAt: string; senderId: string | null; sender: U | null; aiSource?: string | null }
export interface ThreadChat {
  id: string;
  type: string;
  title: string | null;
  archived: boolean;
  partyId: string | null;
  members: { user: U }[];
  messages: ThreadMessage[];
}

export function ChatThread({ chat, meId, squad }: { chat: ThreadChat; meId: string; squad?: SquadHeaderData | null }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(chat.messages);
  const [archived, setArchived] = useState(chat.archived);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const others = chat.members.map((m) => m.user).filter((u) => u.id !== meId);
  const title = chat.type === "direct" ? others[0]?.name : chat.title;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    if (chat.archived) setArchived(true);
    setMessages((ms) => (chat.messages.length > ms.length ? chat.messages : ms));
  }, [chat.archived, chat.messages]);

  useLiveEvents(["chat", "chat-archived"], (topic, data) => {
    const d = data as { chatId: string; message?: ThreadMessage };
    if (d?.chatId !== chat.id) return;
    if (topic === "chat-archived") return setArchived(true);
    if (d.message) {
      setMessages((ms) => (ms.some((m) => m.id === d.message!.id) ? ms : [...ms, d.message!]));
      fetch(`/api/chats/${chat.id}/read`, { method: "POST" }).catch(() => {});
    }
  }, () => {
    // polling fallback (stream buffered): pull the thread and merge anything new
    fetch(`/api/chats/${chat.id}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { archived: boolean; messages: ThreadMessage[] } | null) => {
        if (!j) return;
        if (j.archived) setArchived(true);
        setMessages((ms) => {
          const seen = new Set(ms.map((m) => m.id));
          const fresh = j.messages.filter((m) => !seen.has(m.id));
          return fresh.length ? [...ms, ...fresh] : ms;
        });
      })
      .catch(() => {});
  });

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    const r = await fetch(`/api/chats/${chat.id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
    setSending(false);
    if (r.status === 409) return setArchived(true);
    const j = await r.json().catch(() => null);
    if (j?.ok) {
      const me = chat.members.find((m) => m.user.id === meId)?.user ?? null;
      setMessages((ms) => (ms.some((m) => m.id === j.message.id) ? ms : [...ms, { ...j.message, sender: me }]));
    }
  };

  return (
    <div data-testid="chat-thread" data-archived={archived} className="flex min-h-[calc(100dvh-8.5rem)] flex-col bg-white">
      <div className="sticky top-[52px] z-20 flex items-center gap-2 border-b border-fb-divider bg-white px-3 py-2">
        <Link href="/chats" aria-label="Back"><ArrowLeft size={22} /></Link>
        <span className="truncate font-semibold" data-testid="chat-title">{title}</span>
        {chat.type === "squad" && <span className="rounded bg-queue-glow px-1.5 py-px text-[10px] font-bold uppercase text-white">Squad</span>}
      </div>
      {squad && (
        <SquadHeader squad={{ ...squad, archived }} meId={meId}>
          {!archived && <FindYourParty partyId={squad.partyId} meId={meId} spot={squad.meetingSpot} lat={squad.event.lat} lng={squad.event.lng} />}
          {!archived && <FastForwardButton />}
        </SquadHeader>
      )}
      <ul className="flex-1 space-y-1.5 p-3" data-testid="messages">
        {messages.map((m) => {
          if (m.kind === "system")
            return <li key={m.id} className="py-1 text-center text-xs text-fb-muted" data-testid="msg-system">{m.body}</li>;
          if (m.kind === "host")
            return (
              <li key={m.id} className="flex items-end gap-1.5" data-testid="msg-host">
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1877f2] to-[#a855f7] text-white"><Bot size={15} /></span>
                <span className="max-w-[80%] rounded-2xl border border-[#e9e3ff] bg-gradient-to-br from-[#f3f0ff] to-[#eef5ff] px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-queue-glow">Queue Up Host · AI <AiSourceBadge source={m.aiSource} /></span>
                  {m.body}
                </span>
              </li>
            );
          const mine = m.senderId === meId;
          return (
            <li key={m.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : ""}`} data-testid="msg-user">
              {!mine && m.sender && <Avatar name={m.sender.name} color={m.sender.avatarColor} size={26} />}
              <span className={`max-w-[75%] rounded-2xl px-3 py-1.5 ${mine ? "bg-fb-blue text-white" : "bg-[#e4e6eb]"}`}>
                {!mine && chat.type !== "direct" && m.sender && <span className="block text-[11px] font-semibold text-fb-muted">{m.sender.name.split(" ")[0]}</span>}
                {m.body}
              </span>
            </li>
          );
        })}
        <div ref={bottom} />
      </ul>
      {archived ? (
        <div className="border-t border-fb-divider p-3">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-fb-muted" data-testid="read-only"><Lock size={12} /> This squad chat has ended and is read-only</p>
          {chat.partyId && <ArchivedPrompt partyId={chat.partyId} />}
        </div>
      ) : (
        <form className="sticky bottom-[60px] flex items-center gap-2 border-t border-fb-divider bg-white p-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input data-testid="composer" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={chat.type === "squad" ? "Message your squad (try @host)" : "Aa"}
            className="flex-1 rounded-full bg-fb-bg px-4 py-2 outline-none" />
          <button type="submit" data-testid="send" disabled={!draft.trim()} aria-label="Send" className="text-fb-blue disabled:opacity-40"><SendHorizontal size={24} /></button>
        </form>
      )}
    </div>
  );
}

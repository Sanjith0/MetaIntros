"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Info, Lock, Pin, Star } from "lucide-react";
import { AiLabel, Avatar, Bubble, Button, FacePile, SystemLine, type RunPos } from "@/components/fb";
import { AiSourceLabel } from "@/components/ai/AiSource";
import { Composer } from "@/components/fb/Composer";
import { PrototypeLabel } from "@/components/fb/TopBar";
import { chipClass } from "@/components/fb/Chip";
import { useLiveEvents } from "@/components/useLiveEvents";
import { fmtDuration, fmtEventWhen } from "@/lib/format";
import { nowDate, nowMs } from "@/lib/clock";
import { ArchivedPrompt } from "./ArchivedPrompt";
import type { SquadHeaderInfo } from "@/lib/server/squadChat";
import type { RatingState } from "@/lib/server/ratings";
import { RateSquadSheet } from "./RateSquadSheet";

interface U { id: string; name: string; avatarColor: string; isSimulated?: boolean; isLive?: boolean }
export interface ThreadMessage { id: string; body: string; kind: string; createdAt: string; senderId: string | null; sender: U | null; failed?: boolean; aiSource?: string | null }
export interface ThreadChat {
  id: string;
  type: string;
  title: string | null;
  archived: boolean;
  partyId: string | null;
  members: { user: U }[];
  messages: ThreadMessage[];
}

const first = (n: string) => n.split(" ")[0];
const isSample = (u: U | null | undefined) => Boolean(u?.isSimulated && !u.isLive);
/** Who a bubble belongs to, for grouping runs: a user id, "host", or null (system). */
const who = (m: ThreadMessage) => (m.kind === "host" ? "host" : m.kind === "system" ? null : m.senderId);

function runPos(list: ThreadMessage[], i: number): RunPos {
  const w = who(list[i]);
  const prev = i > 0 && who(list[i - 1]) === w;
  const next = i < list.length - 1 && who(list[i + 1]) === w;
  return prev && next ? "middle" : prev ? "last" : next ? "first" : "single";
}

export function ChatThread({ chat, meId, squad, rating: initialRating = null }: { chat: ThreadChat; meId: string; squad?: SquadHeaderInfo | null; rating?: RatingState | null }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(chat.messages);
  const [archived, setArchived] = useState(chat.archived || Boolean(squad?.archived));
  // Post-event rating pop-up: opens by itself once the chat has ended and you haven't answered yet.
  const [rating, setRating] = useState<RatingState | null>(initialRating);
  const [rateOpen, setRateOpen] = useState(Boolean(initialRating?.askNow));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const others = chat.members.map((m) => m.user).filter((u) => u.id !== meId);
  const title = chat.type === "direct" ? others[0]?.name : chat.title;
  const isSquad = chat.type === "squad" && Boolean(squad);

  useEffect(() => {
    setNow(nowMs()); // the global clock: Fast-forward moves every phone's countdown together
    const t = setInterval(() => setNow(nowMs()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    if (chat.archived) setArchived(true);
    setMessages((ms) => (chat.messages.length > ms.length ? chat.messages : ms));
  }, [chat.archived, chat.messages]);

  // However the chat ended (live event, polling, coming back to the page), ask for a rating once.
  const ratingEnded = Boolean(rating?.ended);
  useEffect(() => {
    if (!archived || ratingEnded || !chat.partyId || chat.type !== "squad") return;
    fetch(`/api/squad/${chat.partyId}/rating`)
      .then((r) => (r.ok ? r.json() : null))
      .then((st: RatingState | null) => {
        if (!st) return;
        setRating(st);
        if (st.askNow) setRateOpen(true);
      })
      .catch(() => {});
  }, [archived, ratingEnded, chat.partyId, chat.type]);

  useLiveEvents(
    ["chat", "chat-archived"],
    (topic, data) => {
      const d = data as { chatId: string; message?: ThreadMessage };
      if (d?.chatId !== chat.id) return;
      if (topic === "chat-archived") return setArchived(true);
      if (d.message) {
        setMessages((ms) => (ms.some((m) => m.id === d.message!.id) ? ms : [...ms, d.message!]));
        fetch(`/api/chats/${chat.id}/read`, { method: "POST" }).catch(() => {});
      }
    },
    () => {
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
    },
  );

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    const r = await fetch(`/api/chats/${chat.id}/messages`, { method: "POST", body: JSON.stringify({ body }) }).catch(() => null);
    setSending(false);
    if (r?.status === 409) return setArchived(true);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.ok) {
      const me = chat.members.find((m) => m.user.id === meId)?.user ?? null;
      setMessages((ms) => (ms.some((m) => m.id === j.message.id) ? ms : [...ms, { ...j.message, sender: me }]));
    } else {
      // Not sent: keep it visible with a retry (UX states, from swarit F17).
      setMessages((ms) => [...ms, { id: `failed-${Date.now()}`, body, kind: "user", createdAt: nowDate().toISOString(), senderId: meId, sender: null, failed: true }]);
    }
  };

  const expiry = squad?.expiresAt && now != null ? (archived ? "Chat ended" : `Ends in ${fmtDuration(new Date(squad.expiresAt).getTime() - now)}`) : null;

  return (
    <div data-testid="chat-thread" data-archived={archived} className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 bg-surface">
        <div className="flex h-14 items-center gap-2 border-b border-divider/60 px-2">
          <Link href="/chats" aria-label="Back to chats" className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-press">
            <ChevronLeft size={28} strokeWidth={2.2} className="text-accent" />
          </Link>
          {chat.type === "direct" && others[0] ? (
            <Avatar name={others[0].name} color={others[0].avatarColor} size={36} />
          ) : (
            <span data-testid="squad-header-members"><FacePile people={others.slice(0, 2)} size={28} max={2} /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold" data-testid="chat-title">{title}</p>
            <p className="truncate text-meta text-muted" data-testid={isSquad ? "squad-header-expiry" : undefined}>
              {chat.type === "direct" ? "Messenger" : `${chat.members.length} members`}
              {expiry && ` · ${expiry}`}
            </p>
          </div>
          {isSquad && squad && (
            <Link href={`/squad/${squad.partyId}`} aria-label="Squad info" data-testid="squad-info" className="press inline-flex h-10 w-10 items-center justify-center rounded-full text-accent hover:bg-press">
              <Info size={24} />
            </Link>
          )}
        </div>
        <PrototypeLabel />
        {isSquad && squad && (
          <Link href={`/squad/${squad.partyId}`} data-testid="squad-header" className="flex items-center gap-3 border-b border-divider/60 bg-surface px-4 py-2 hover:bg-press">
            <Pin size={16} className="shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-meta font-semibold" data-testid="squad-header-event">{squad.event.title}</span>
              <span className="block truncate text-meta text-muted">
                <span data-testid="squad-header-time">{fmtEventWhen(new Date(squad.event.startsAt))}</span> ·{" "}
                <span data-testid="squad-header-spot">Meet: {squad.meetingSpot}</span>
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </Link>
        )}
      </header>

      <ul className="flex-1 px-3 pt-2 pb-3" data-testid="messages">
        {messages.map((m, i) => {
          if (m.kind === "system") return <SystemLine key={m.id} testId="msg-system">{m.body}</SystemLine>;
          const pos = runPos(messages, i);
          const startsRun = pos === "single" || pos === "first";
          const endsRun = pos === "single" || pos === "last";
          if (m.kind === "host")
            return (
              <li key={m.id} className={`flex items-end gap-2 ${startsRun ? "mt-2" : "mt-0.5"}`} data-testid="msg-host">
                <span className="w-7 shrink-0">
                  {endsRun && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-control text-ink" aria-hidden>
                      <Bot size={16} />
                    </span>
                  )}
                </span>
                <span className="max-w-[75%]">
                  {startsRun && (
                    <span className="mb-0.5 ml-3 flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted">
                      Queue Up host {m.aiSource ? <AiSourceLabel source={m.aiSource} className="text-[12px]" /> : <AiLabel className="text-[12px]">AI</AiLabel>}
                    </span>
                  )}
                  <Bubble mine={false} pos={pos}>{m.body}</Bubble>
                </span>
              </li>
            );
          const mine = m.senderId === meId;
          return (
            <li key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : ""} ${startsRun ? "mt-2" : "mt-0.5"}`} data-testid="msg-user">
              {!mine && <span className="w-7 shrink-0">{endsRun && m.sender && <Avatar name={m.sender.name} color={m.sender.avatarColor} size={28} />}</span>}
              <span className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                {!mine && startsRun && chat.type !== "direct" && m.sender && (
                  <span className="mb-0.5 ml-3 block text-[12px] text-muted">
                    {first(m.sender.name)}
                    {isSquad && isSample(m.sender) && " · Sample person"}
                  </span>
                )}
                <Bubble mine={mine} pos={pos} className={m.failed ? "opacity-60" : undefined}>{m.body}</Bubble>
                {m.failed && (
                  <button type="button" className="mt-0.5 block w-full text-right text-[12px] font-semibold text-badge" onClick={() => { setMessages((ms) => ms.filter((x) => x.id !== m.id)); send(m.body); }}>
                    Not sent · Try again
                  </button>
                )}
              </span>
            </li>
          );
        })}
        <div ref={bottom} />
      </ul>

      {archived ? (
        <div className="sticky bottom-0 border-t border-divider bg-surface px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-meta text-muted" data-testid="read-only">
            <Lock size={12} aria-hidden /> This squad chat has ended. You can still read it.
          </p>
          {rating?.ended && (
            rating.mine?.stars ? (
              <p className="mb-2 flex items-center justify-center gap-1.5 text-meta text-muted" data-testid="rated-line">
                <Star size={12} className="fill-muted" aria-hidden /> Thanks. You rated this night {rating.mine.stars} of 5.{" "}
                <button type="button" className="font-semibold text-link" onClick={() => setRateOpen(true)} data-testid="rate-edit">Edit</button>
              </p>
            ) : (
              <Button block className="mb-2" icon={<Star size={16} />} onClick={() => setRateOpen(true)} data-testid="rate-open">
                Rate your squad
              </Button>
            )
          )}
          {chat.partyId && <ArchivedPrompt partyId={chat.partyId} />}
        </div>
      ) : (
        <div className="sticky bottom-0 bg-surface">
          {isSquad && squad && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-2" aria-label="Quick replies">
              <button type="button" className={chipClass(false, "h-8 text-meta")} onClick={() => setDraft((d) => (d.startsWith("@host") ? d : `@host ${d}`))} data-testid="ask-host">
                Ask the host
              </button>
              <Link href={`/squad/${squad.partyId}/cards`} className={chipClass(false, "h-8 text-meta")} data-testid="open-talk-cards">
                Talk cards
              </Link>
              <Link href={`/squad/${squad.partyId}/find`} className={chipClass(false, "h-8 text-meta")} data-testid="open-find">
                Find each other
              </Link>
            </div>
          )}
          <Composer value={draft} onChange={setDraft} onSend={() => send()} disabled={sending} />
        </div>
      )}
      {rating && (
        <RateSquadSheet
          key={rating.mine ? "edit" : "new"}
          open={rateOpen}
          state={rating}
          onClose={(skipped) => {
            setRateOpen(false);
            if (skipped && !rating.mine) {
              // "Not now": the pop-up won't come back; "Rate your squad" stays in the footer.
              fetch(`/api/squad/${rating.partyId}/rating`, { method: "POST", body: JSON.stringify({ skip: true }) }).catch(() => {});
              setRating({ ...rating, mine: { stars: null, mates: {} }, askNow: false });
            }
          }}
          onSaved={(st) => {
            setRating(st);
            setRateOpen(false);
          }}
        />
      )}
    </div>
  );
}

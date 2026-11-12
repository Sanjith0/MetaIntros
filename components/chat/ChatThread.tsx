"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/contracts";
import { Avatar } from "@/components/Avatar";
import { IconPin, IconSend, IconSparkle } from "@/components/icons";
import { useLiveEvents } from "@/components/live/LiveProvider";
import { WhyLine } from "@/components/party/WhyLine";
import type { SourceItem } from "@/lib/stage/provenance";
import { chatTime } from "@/lib/format";

type People = Record<string, { name: string; firstName: string; hue: number }>;

/** Message list + composer. Bubbles follow the reference tokens:
 *  incoming #F0F0F0, outgoing accent, 8/12 padding, 18px radius. */
export function ChatThread({
  chatId,
  viewerId,
  initial,
  pinned: pinnedInitial,
  people,
  hereFor = null,
  retry = true,
  why = {},
}: {
  chatId: string;
  viewerId: string;
  initial: ChatMessage[];
  pinned: ChatMessage | null;
  people: People;
  /** Party id: shows an "I'm here" button until this person has arrived. */
  hereFor?: string | null;
  /** F17: offer "Try again" when a message fails to send. */
  retry?: boolean;
  /** F32: where each machine-written message came from, by message id. */
  why?: Record<string, SourceItem[]>;
}) {
  const [showHere, setShowHere] = useState(!!hereFor);
  const imHere = async () => {
    setShowHere(false);
    await fetch("/api/door/arrive", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId: hereFor }) });
  };
  const [messages, setMessages] = useState(initial);
  const [pinned, setPinned] = useState(pinnedInitial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const composer = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useLiveEvents((e) => {
    if (e.type !== "chat.message" || e.payload.chatId !== chatId) return;
    const m = e.payload;
    setMessages((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
    if (m.kind === "pinned") setPinned(m);
  });

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    setFailed(null);
    try {
      const res = await fetch(`/api/chat/${chatId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error(String(res.status));
      const { message } = (await res.json()) as { message: ChatMessage };
      setMessages((xs) => (xs.some((x) => x.id === message.id) ? xs : [...xs, message]));
    } catch {
      setFailed(text);
    }
    setSending(false);
  };

  const visible = messages;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {pinned && (
        <div data-testid="pinned-banner" className="flex items-center gap-2 border-b border-[var(--color-divider)] bg-white px-4 py-2">
          <IconPin size={16} className="shrink-0 text-[var(--color-ink-2)]" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-[var(--color-ink-2)]">Pinned</div>
            <div className="truncate text-[13px]">{pinned.text}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white px-3 py-4" data-testid="message-list" role="log" aria-label="Messages" tabIndex={0}>
        <div className="mb-3 text-center text-[12px] text-[var(--color-ink-2)]">Today</div>
        {visible.map((m, i) => {
          const prev = visible[i - 1];
          const next = visible[i + 1];
          if (m.kind === "system" || m.kind === "pinned") {
            return (
              <div key={m.id} className="my-3 flex justify-center px-6">
                <div className={`max-w-[520px] rounded-[12px] px-3 py-2 text-center text-[12px] ${m.kind === "pinned" ? "border border-[var(--color-pq)]/25 bg-[var(--color-pq-soft)] text-[var(--color-pq-ink)]" : "text-[var(--color-ink-2)]"}`}>
                  {m.kind === "pinned" && (
                    <span className="mb-0.5 flex items-center justify-center gap-1 font-semibold">
                      <IconPin size={12} /> Pinned
                    </span>
                  )}
                  {m.text}
                  {why[m.id] && (
                    <div className="text-left">
                      <WhyLine items={why[m.id]!} testid={`why-${m.id}`} />
                    </div>
                  )}
                </div>
              </div>
            );
          }
          const mine = m.senderId === viewerId;
          const firstOfRun = !prev || prev.senderId !== m.senderId || prev.kind === "system" || prev.kind === "pinned";
          const lastOfRun = !next || next.senderId !== m.senderId || next.kind === "system" || next.kind === "pinned";
          const who = m.senderId ? people[m.senderId] : undefined;
          const radius = mine
            ? `rounded-[18px] ${firstOfRun ? "" : "rounded-tr-[4px]"} ${lastOfRun ? "" : "rounded-br-[4px]"}`
            : `rounded-[18px] ${firstOfRun ? "" : "rounded-tl-[4px]"} ${lastOfRun ? "" : "rounded-bl-[4px]"}`;
          return (
            <Fragment key={m.id}>
            <div data-testid={m.kind === "opener" ? "opener-message" : "message"} data-message-id={m.id} className={`flex items-end gap-2 ${firstOfRun ? "mt-2" : "mt-[2px]"} ${mine ? "justify-end" : ""}`}>
              {!mine && <span className="w-7 shrink-0">{lastOfRun && who && <Avatar name={who.name} hue={who.hue} size={28} />}</span>}
              <div className={`flex max-w-[65%] flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && firstOfRun && who && <span className="mb-0.5 ml-3 text-[12px] text-[var(--color-ink-2)]">{who.firstName}</span>}
                {m.kind === "opener" && firstOfRun && (
                  <span className="mb-0.5 flex items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-pq)]">
                    <IconSparkle size={12} /> Suggested opener
                  </span>
                )}
                <div
                  title={chatTime(m.at)}
                  className={`px-3 py-2 text-[15px] ${radius} ${
                    m.kind === "opener"
                      ? "border border-dashed border-[var(--color-pq)]/50 bg-[var(--color-pq-soft)] text-[var(--color-ink)]"
                      : mine
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-bubble-in)] text-[var(--color-ink)]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
              </div>
              {/* Below the row, so the avatar stays beside the bubble. */}
              {why[m.id] && (
                <div className={`mt-0.5 flex ${mine ? "justify-end pr-3" : "pl-12"}`}>
                  <div className={`max-w-[75%] ${mine ? "text-right [&>details>div]:text-left" : ""}`}>
                    <WhyLine items={why[m.id]!} testid={`why-${m.id}`} />
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
        <div ref={end} />
      </div>

      {failed && retry && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-divider)] bg-white px-3 py-1.5 text-[13px]" role="alert" data-testid="send-failed">
          <span className="max-w-[60%] truncate text-[var(--color-ink-2)]">“{failed}”</span>
          <span className="font-semibold text-[var(--color-badge)]">Not sent.</span>
          <button
            className="font-semibold text-[var(--color-link)] hover:underline"
            data-testid="send-retry"
            onClick={() => {
              setDraft(failed);
              setFailed(null);
              composer.current?.focus();
            }}
          >
            Try again
          </button>
        </div>
      )}
      {showHere && (
        <div className="flex justify-center border-t border-[var(--color-divider)] bg-white pt-2">
          <button data-testid="chat-im-here" onClick={imHere} className="press rounded-full bg-[var(--color-pq-soft)] px-4 py-1.5 text-[14px] font-semibold text-[var(--color-pq)]">
            📍 I'm here
          </button>
        </div>
      )}
      <form
        className="flex items-center gap-2 border-t border-[var(--color-divider)] bg-white px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[22px] font-light text-[var(--color-accent)]">+</span>
        <input
          ref={composer}
          data-testid="composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Aa"
          aria-label="Message"
          className="h-9 min-w-0 flex-1 rounded-[20px] bg-[var(--color-wash)] px-3 text-[15px] outline-none placeholder:text-[var(--color-ink-2)]"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-accent)] hover:bg-black/5 disabled:opacity-40"
        >
          <IconSend size={20} />
        </button>
      </form>
    </div>
  );
}

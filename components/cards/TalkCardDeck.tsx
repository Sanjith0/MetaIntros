"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, Copy, Heart, MessageSquareQuote, Sparkles, Users, Zap } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { CardContent, ClaimKind } from "@/lib/cards/claims";

interface Card {
  subject: { id: string; name: string; avatarColor: string };
  content: CardContent;
}

const KIND_ICON: Record<ClaimKind, typeof Heart> = { shared_interest: Heart, mutual_friends: Users, event_overlap: CalendarCheck, pattern: Zap, spark: Sparkles };

function humanSource(src: string, meId: string) {
  if (src === "mutualFriends") return "mutual friends";
  if (src.startsWith("preChat:")) return "AI pre-chat (simulated)";
  const [uid, field] = src.split(":");
  const f = field.replace(/\[\d+\]/, "");
  const name = { likes: "likes", groups: "groups", music: "music", events: "events", x_not_interested: "not-interested list", socialStyle: "activity pattern", availability: "availability" }[f] ?? f;
  return `${uid === meId ? "your" : "their"} ${name}`;
}

export function TalkCardDeck({ cards, meId, initialMember, chatId, eventTitle }: { cards: Card[]; meId: string; initialMember: string | null; chatId: string | null; eventTitle: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const i = Math.max(0, cards.findIndex((c) => c.subject.id === initialMember));
    const el = strip.current;
    if (el && i > 0) el.scrollTo({ left: i * el.clientWidth, behavior: "instant" as ScrollBehavior });
    setActive(i);
  }, [cards, initialMember]);

  const onScroll = () => {
    const el = strip.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "smooth" });

  return (
    <div data-testid="talk-cards" className="min-h-[80dvh] bg-gradient-to-b from-[#f3f0ff] to-fb-bg pb-6">
      <div className="flex items-center gap-2 px-3 py-2">
        {chatId && <Link href={`/chats/${chatId}`} aria-label="Back to squad chat"><ArrowLeft size={22} /></Link>}
        <div>
          <h1 className="font-bold leading-tight">Talk cards</h1>
          <p className="text-xs text-fb-muted">{eventTitle} · swipe through your squad</p>
        </div>
      </div>
      <div ref={strip} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]" data-testid="card-strip">
        {cards.map((c) => (
          <article key={c.subject.id} className="w-full shrink-0 snap-center px-3" data-testid={`talk-card-${c.subject.id}`}>
            <div className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-[#e9e3ff]">
              <div className="flex items-center gap-3 bg-gradient-to-r from-[#1877f2] to-[#9333ea] p-4 text-white">
                <Avatar name={c.subject.name} color={c.subject.avatarColor} size={60} ring />
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-80">You &amp;</p>
                  <p className="text-xl font-extrabold leading-tight">{c.subject.name}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <ul className="space-y-2" data-testid="card-claims">
                  {c.content.claims.map((cl, i) => {
                    const Icon = KIND_ICON[cl.kind] ?? Heart;
                    return (
                      <li key={i} className="flex gap-2" data-testid="claim" data-kind={cl.kind}>
                        <Icon size={18} className="mt-0.5 shrink-0 text-queue-glow" />
                        <span>
                          <span className="block leading-snug">{cl.text}</span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {cl.sources.map((s) => (
                              <span key={s} className="rounded bg-fb-bg px-1.5 text-[10px] text-fb-muted" data-testid="claim-source">{humanSource(s, meId)}</span>
                            ))}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                  {c.content.claims.length === 0 && <li className="text-sm text-fb-muted">You&apos;ll find out together 🙂</li>}
                </ul>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-bold"><MessageSquareQuote size={16} /> Try opening with</p>
                  <ul className="space-y-1.5" data-testid="card-openers">
                    {c.content.openers.map((o) => (
                      <li key={o}>
                        <button type="button" onClick={() => { navigator.clipboard?.writeText(o).catch(() => {}); setCopied(o); }}
                          className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#f3f0ff] px-3 py-2 text-left text-sm">
                          <span>“{o}”</span>
                          <Copy size={14} className={`shrink-0 ${copied === o ? "text-emerald-500" : "text-fb-muted"}`} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[10px] leading-snug text-fb-muted">AI-assisted · every fact cites the Facebook data it came from · politics, religion, health &amp; sexuality are never shown</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5" data-testid="card-dots">
        {cards.map((c, i) => (
          <button key={c.subject.id} type="button" aria-label={`Card ${i + 1}`} onClick={() => go(i)}
            className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-queue-glow" : "w-2 bg-[#c4b5fd]"}`} />
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-fb-muted" data-testid="card-position">{cards.length ? `${active + 1} of ${cards.length}` : "No cards yet"}</p>
    </div>
  );
}

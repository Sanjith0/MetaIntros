"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Copy, Shapes, Sparkles, Tag, Users } from "lucide-react";
import { AiLabel, Avatar, Bubble, cn } from "@/components/fb";
import { AiSourceLabel } from "@/components/ai/AiSource";
import { stripCitations } from "@/lib/companion/text";

import { TopBar } from "@/components/fb/TopBar";
import { useToast } from "@/components/fb/Toast";
import type { CardContent, ClaimKind } from "@/lib/cards/claims";

/** Say who actually wrote the openers: a template is never presented as AI. */
function openersLine(c: CardContent) {
  const src = c.aiSource ?? (c.generatedBy === "template" ? "fallback" : undefined);
  if (src === "fallback" || src === "template") return "Openers from a template built on the facts above (AI unavailable).";
  if (src === "cache") return "Openers written by AI from the facts above (saved AI response).";
  if (src === "live") return "Openers written by AI just now from the facts above.";
  if (src === "mock") return "Openers from the test model, built on the facts above.";
  return "Openers written by AI from the facts above.";
}

interface PreChat {
  meIsA: boolean;
  transcript: { speaker: "A" | "B"; text: string }[];
  sparks: string[];
  simulated: boolean;
  source?: string | null;
}
interface Card {
  subject: { id: string; name: string; avatarColor: string; isSimulated?: boolean; isLive?: boolean };
  content: CardContent;
  preChat?: PreChat | null;
}

const KIND_ICON: Record<ClaimKind, typeof Tag> = { shared_interest: Tag, mutual_friends: Users, event_overlap: CalendarCheck, pattern: Shapes, spark: Sparkles };

function humanSource(src: string, meId: string) {
  if (src === "mutualFriends") return "mutual friends";
  if (src.startsWith("preChat:")) return "Companion conversation (AI)";
  const [uid, field] = src.split(":");
  const f = field.replace(/\[\d+\]/, "");
  const name = { likes: "likes", groups: "groups", music: "music", events: "events", x_not_interested: "not-interested list", socialStyle: "activity pattern", availability: "availability" }[f] ?? f;
  return `${uid === meId ? "your" : "their"} ${name}`;
}

const first = (n: string) => n.split(" ")[0];

/** Talk cards: one card per squadmate, with the facts each line came from and suggested openers. */
export function TalkCardDeck({ cards, meId, initialMember, partyId, eventTitle }: { cards: Card[]; meId: string; initialMember: string | null; partyId: string; eventTitle: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const toast = useToast();

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
    <div data-testid="talk-cards" className="pb-4">
      <TopBar back={`/squad/${partyId}`} title="Talk cards" />
      <div className="bg-surface px-4 pt-2 pb-3">
        <p className="text-meta text-muted">{eventTitle} · what you have in common with each person</p>
        <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto" role="tablist" aria-label="Squad members">
          {cards.map((c, i) => (
            <button key={c.subject.id} type="button" role="tab" aria-selected={i === active} onClick={() => go(i)} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <Avatar name={c.subject.name} color={c.subject.avatarColor} size={44} className={cn(i === active && "ring-2 ring-accent ring-offset-2 ring-offset-surface")} />
              <span className={cn("w-full truncate text-center text-meta", i === active ? "font-semibold text-ink" : "text-muted")}>{first(c.subject.name)}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={strip} onScroll={onScroll} className="no-scrollbar mt-2 flex snap-x snap-mandatory overflow-x-auto" data-testid="card-strip">
        {cards.map((c) => (
          <article key={c.subject.id} className="w-full shrink-0 snap-center px-3" data-testid={`talk-card-${c.subject.id}`}>
            <div className="overflow-hidden rounded-card bg-surface shadow-card">
              <div className="flex items-center gap-3 border-b border-divider/60 p-4">
                <Avatar name={c.subject.name} color={c.subject.avatarColor} size={56} />
                <div className="min-w-0">
                  <p className="text-meta text-muted">You and</p>
                  <p className="truncate text-headline font-bold">{c.subject.name}</p>
                  {c.subject.isSimulated && !c.subject.isLive && <p className="text-meta text-muted">Sample person</p>}
                </div>
              </div>
              <div className="space-y-4 p-4">
                <section>
                  <h3 className="text-body font-semibold">What you have in common</h3>
                  <ul className="mt-2 space-y-3" data-testid="card-claims">
                    {c.content.claims.map((cl, i) => {
                      const Icon = KIND_ICON[cl.kind] ?? Tag;
                      return (
                        <li key={i} className="flex gap-3" data-testid="claim" data-kind={cl.kind}>
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-control" aria-hidden>
                            <Icon size={16} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-body">{stripCitations(cl.text)}</span>
                            <span className="block text-meta text-muted">
                              From{" "}
                              {cl.sources.map((s, j) => (
                                <span key={s} data-testid="claim-source">{j > 0 ? ", " : ""}{humanSource(s, meId)}</span>
                              ))}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                    {c.content.claims.length === 0 && <li className="text-body text-muted">Nothing on file yet. You&apos;ll find out together.</li>}
                  </ul>
                </section>
                <section>
                  <h3 className="text-body font-semibold">Try opening with</h3>
                  <ul className="mt-2 divide-y divide-divider/60 rounded-card bg-wash" data-testid="card-openers">
                    {c.content.openers.map((o) => (
                      <li key={o}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(stripCitations(o)).catch(() => {});
                            toast("Copied. Paste it in your squad chat.");
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-body hover:bg-press"
                        >
                          <span>{stripCitations(o)}</span>
                          <Copy size={16} className="shrink-0 text-muted" aria-label="Copy" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
                {c.preChat && (
                  <details className="rounded-card bg-wash p-3" data-testid="prechat">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-body font-semibold">
                      What your Companions talked about
                      <span className="flex items-center gap-1.5">
                        {c.preChat.transcript.length > 6 && <span className="text-meta font-normal text-link" data-testid="prechat-deep">Went deeper</span>}
                        <span className="text-meta font-normal text-muted" data-testid="prechat-label">AI simulation</span>
                      </span>
                    </summary>
                    <p className="mt-1 text-meta text-muted">Your Companion AI and theirs talked before you were matched. Each one knew only its own person, and only what they chose to share. These are not real messages.</p>
                    <AiSourceLabel source={c.preChat.source} className="mt-1" />
                    <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1" data-testid="prechat-thread">
                      {c.preChat.transcript.map((t, i) => {
                        const mine = (t.speaker === "A") === c.preChat!.meIsA;
                        return (
                          <li key={i} className={cn("flex", mine && "justify-end")}>
                            <span className="max-w-[85%]">
                              <span className={cn("mb-0.5 block text-[12px] text-muted", mine && "text-right")}>{mine ? "Your Companion" : `${first(c.subject.name)}'s Companion`}</span>
                              <Bubble mine={mine}>{stripCitations(t.text)}</Bubble>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {c.preChat.sparks.length > 0 && <p className="mt-2 text-meta">Topics that came up: {c.preChat.sparks.map(stripCitations).join(", ")}</p>}
                  </details>
                )}
                <AiLabel className="leading-snug" testId="openers-source">{openersLine(c.content)} Politics, religion, health and sexuality are never used.</AiLabel>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-center text-meta text-muted" data-testid="card-position">{cards.length ? `${active + 1} of ${cards.length}` : "No cards yet"}</p>
    </div>
  );
}

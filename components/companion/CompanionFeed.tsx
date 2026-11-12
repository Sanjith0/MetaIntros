"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, ChevronDown, Lock, MessagesSquare, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useLiveEvents } from "@/components/useLiveEvents";
import { CompanionThread, ScorePill, type ThreadLine } from "./CompanionThread";

interface Notes {
  score: number;
  wouldEnjoy: string[];
  concerns: string[];
  needs: string[];
  confidence: string;
}

interface View {
  stage: string | null;
  note?: string;
  roomSize?: number;
  circle?: { theme: string; size: number } | null;
  people?: Record<string, { name: string; avatarColor: string }>;
  conversations?: { with: string; deep: boolean; notes: Notes | null; lines: ThreadLine[] }[];
  proposals?: { by: string; members: string[]; line: string; backers: number }[];
  groups?: { members: string[]; lines: { from: string; say: string }[]; status: "talking" | "agreed" | "didnt_work" }[];
}

const first = (n?: string) => (n ?? "Someone").split(" ")[0];

/**
 * "Your Companion is talking": the conversations the current user's Companion is having while
 * the room runs. Only this user's own Companion's conversations and notes are ever shown.
 */
export function CompanionFeed({ meId }: { meId?: string }) {
  const [view, setView] = useState<View | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const v: View | null = await fetch("/api/queue/companion").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (v) setView(v);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 1200);
    return () => clearInterval(t);
  }, [load]);
  useLiveEvents(["queue"], () => void load());

  if (!view?.stage || !view.conversations) return null;
  const people = view.people ?? {};
  const name = (id: string) => first(people[id]?.name);
  const convs = view.conversations;
  const scored = convs.filter((c) => c.notes).length;
  const shownOpen = open ?? convs[0]?.with ?? null;

  return (
    <section className="mt-6 text-left" data-testid="companion-feed">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold"><Bot size={18} className="text-[#c4b5fd]" /> Your Companion is talking</h2>
        <span className="text-[11px] text-[#c7d2fe]" data-testid="feed-count">{convs.length} {convs.length === 1 ? "conversation" : "conversations"}</span>
      </div>
      <p className="mt-0.5 text-xs text-[#c7d2fe]">
        It speaks for you to everyone else&apos;s Companion{view.circle ? ` in your circle of ${view.circle.size}` : ""}, using only what you chose to share. You see its private read on each person; nobody sees theirs on you.
      </p>
      {scored > 0 && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-[#a5b4fc]"><Lock size={11} /> Scores are your Companion&apos;s private notes</p>
      )}

      <ul className="mt-3 space-y-2" data-testid="feed-conversations">
        {convs.map((c) => {
          const isOpen = shownOpen === c.with;
          const last = c.lines[c.lines.length - 1];
          return (
            <li key={c.with} className="rounded-2xl bg-white/8 ring-1 ring-white/10" data-testid="feed-conversation" data-with={c.with}>
              <button type="button" className="flex w-full items-center gap-2.5 p-2.5 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : c.with)}>
                <Avatar name={people[c.with]?.name ?? "?"} color={people[c.with]?.avatarColor} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {name(c.with)}&apos;s Companion
                    {c.deep && <span className="rounded bg-[#a855f7]/30 px-1.5 text-[9px] font-bold uppercase tracking-wide" data-testid="feed-deep">going deeper</span>}
                  </span>
                  {!isOpen && last && <span className="block truncate text-xs text-[#c7d2fe]">{last.from === "me" ? "You: " : ""}{last.say}</span>}
                </span>
                {c.notes && <ScorePill score={c.notes.score} />}
                <ChevronDown size={16} className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="space-y-2 px-2.5 pb-3">
                  <CompanionThread lines={c.lines} otherName={name(c.with)} />
                  {c.notes && (
                    <div className="rounded-xl bg-black/25 p-2.5 text-xs" data-testid="feed-notes">
                      <p className="font-semibold text-[#c4b5fd]">Your Companion&apos;s private read</p>
                      {c.notes.wouldEnjoy[0] && <p className="mt-1">👍 {c.notes.wouldEnjoy[0]}</p>}
                      {c.notes.concerns[0] && <p className="mt-0.5">⚠️ {c.notes.concerns[0]}</p>}
                      {c.notes.needs[0] && <p className="mt-0.5">🙏 {c.notes.needs[0]}</p>}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {(view.proposals?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10" data-testid="feed-proposals">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Users size={15} /> Squads proposed with you</p>
          <ul className="mt-2 space-y-1.5">
            {view.proposals!.map((p, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold">{p.by === meId ? "Your Companion" : `${name(p.by)}'s Companion`}:</span>{" "}
                {p.members.map((m) => (m === meId ? "you" : name(m))).join(", ")}
                {p.backers > 0 && <span className="text-[#a5b4fc]"> · backed by {p.backers}</span>}
                {p.line && <span className="block text-[#c7d2fe]">&ldquo;{p.line}&rdquo;</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.groups?.map((g, i) => (
        <div key={i} className="mt-4 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10" data-testid="feed-group" data-status={g.status}>
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <MessagesSquare size={15} /> {g.status === "didnt_work" ? "This group didn't work out. Looking again." : "Your squad's Companions are talking it over"}
          </p>
          {g.status !== "didnt_work" && (
            <ul className="mt-2 space-y-1">
              {g.lines.map((l, j) => (
                <li key={j} className="text-xs"><span className="font-semibold">{l.from === meId ? "Your Companion" : `${name(l.from)}'s`}:</span> {l.say}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Lock, MessagesSquare, Users } from "lucide-react";
import { AiLabel, Avatar, Section } from "@/components/fb";
import { useLiveEvents } from "@/components/useLiveEvents";
import { stripCitations } from "@/lib/companion/text";
import { CompanionThread, ScorePill, type ThreadLine } from "./CompanionThread";
import { CheckInCard, CheckInSent, type CheckInView } from "./CheckInCard";

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
  /** before a squad is ready, everyone but you shows as a first name, age and intro, with a blurred avatar */
  people?: Record<string, { name: string; avatarColor: string; anonymous?: boolean; age?: number; about?: string; traits?: string[] }>;
  conversations?: { with: string; deep: boolean; notes: Notes | null; lines: ThreadLine[] }[];
  proposals?: { by: string; members: string[]; line: string; backers: number }[];
  groups?: { members: string[]; lines: { from: string; say: string }[]; status: "talking" | "agreed" | "didnt_work" }[];
  checkIn?: CheckInView | null;
}

const first = (n?: string) => (n ?? "Someone").split(" ")[0];

/** Who this Companion speaks for: first name, age, their own intro line and a few personality words. */
function PersonIntro({ person }: { person?: NonNullable<View["people"]>[string] }) {
  if (!person?.about && !person?.traits?.length) return null;
  return (
    <div className="rounded-card bg-wash p-2.5" data-testid="feed-person">
      <p className="text-meta font-semibold text-muted">
        {first(person.name)}{person.age ? `, ${person.age}` : ""}{person.traits?.length ? ` · ${person.traits.join(", ")}` : ""}
      </p>
      {person.about && <p className="mt-0.5 text-body">&ldquo;{person.about}&rdquo;</p>}
    </div>
  );
}

/**
 * "Your Companion is talking": the conversations the current user's Companion is having while the
 * room runs. Only this user's own Companion's conversations and notes are shown, and other people
 * stay anonymous until the squad is ready.
 */
export function CompanionFeed({ meId }: { meId?: string }) {
  const [view, setView] = useState<View | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
  const shownOpen = open ?? convs[0]?.with ?? null;

  return (
    <Section title="Your Companion is talking" testId="companion-feed" action={<AiLabel>AI</AiLabel>}>
      <p className="text-body text-muted">
        It speaks for you to the other people&apos;s Companions{view.circle ? ` in your group of ${view.circle.size}` : ""}, using only what you chose to share.
      </p>
      <p className="mt-1 flex items-center gap-1 text-meta text-muted"><Lock size={12} /> Scores are your Companion&apos;s private notes. Nobody sees theirs on you.</p>

      {view.checkIn ? (
        <CheckInCard key={view.checkIn.id} checkIn={view.checkIn} people={people} meId={meId} onSent={() => setSentAt(Date.now())} />
      ) : (
        sentAt > 0 && now - sentAt < 4000 && <CheckInSent />
      )}

      <p className="mt-3 text-meta text-muted" data-testid="feed-count">{convs.length} {convs.length === 1 ? "conversation" : "conversations"}</p>
      <ul className="mt-1 divide-y divide-divider" data-testid="feed-conversations">
        {convs.map((c) => {
          const isOpen = shownOpen === c.with;
          const last = c.lines[c.lines.length - 1];
          return (
            <li key={c.with} data-testid="feed-conversation" data-with={c.with}>
              <button type="button" className="flex min-h-11 w-full items-center gap-3 py-2 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : c.with)}>
                <Avatar name={people[c.with]?.name ?? "?"} color={people[c.with]?.avatarColor} size={40} blurred={people[c.with]?.anonymous} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-body font-semibold">
                    {name(c.with)}&apos;s Companion
                    {c.deep && <span className="rounded-full bg-on px-2 text-meta font-semibold text-link" data-testid="feed-deep">Going deeper</span>}
                  </span>
                  {!isOpen && last && <span className="block truncate text-meta text-muted">{last.from === "me" ? "Yours: " : ""}{stripCitations(last.say)}</span>}
                </span>
                {c.notes && <ScorePill score={c.notes.score} />}
                <ChevronDown size={18} className={`shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="space-y-2 pb-3">
                  <PersonIntro person={people[c.with]} />
                  <CompanionThread lines={c.lines} otherName={name(c.with)} />
                  {c.notes && (
                    <div className="rounded-card bg-wash p-2.5 text-body" data-testid="feed-notes">
                      <p className="text-meta font-semibold text-muted">Your Companion&apos;s private read</p>
                      {c.notes.wouldEnjoy[0] && <p className="mt-1">You&apos;d enjoy: {stripCitations(c.notes.wouldEnjoy[0])}</p>}
                      {c.notes.concerns[0] && <p className="mt-0.5">Watch out: {stripCitations(c.notes.concerns[0])}</p>}
                      {c.notes.needs[0] && <p className="mt-0.5">You&apos;d need: {stripCitations(c.notes.needs[0])}</p>}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {(view.proposals?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-card bg-wash p-3" data-testid="feed-proposals">
          <p className="flex items-center gap-1.5 text-body font-semibold"><Users size={16} /> Squads proposed with you</p>
          <ul className="mt-1 space-y-1.5">
            {view.proposals!.map((p, i) => (
              <li key={i} className="text-body">
                <span className="font-semibold">{p.by === meId ? "Your Companion" : `${name(p.by)}'s Companion`}:</span>{" "}
                {p.members.map((m) => (m === meId ? "you" : name(m))).join(", ")}
                {p.backers > 0 && <span className="text-muted"> · backed by {p.backers}</span>}
                {p.line && <span className="block text-meta text-muted">&ldquo;{stripCitations(p.line)}&rdquo;</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.groups?.map((g, i) => (
        <div key={i} className="mt-3 rounded-card bg-wash p-3" data-testid="feed-group" data-status={g.status}>
          <p className="flex items-center gap-1.5 text-body font-semibold">
            <MessagesSquare size={16} /> {g.status === "didnt_work" ? "This group didn't work out. Looking again." : "Your squad's Companions are talking it over"}
          </p>
          {g.status !== "didnt_work" && (
            <ul className="mt-1 space-y-1">
              {g.lines.map((l, j) => (
                <li key={j} className="text-body"><span className="font-semibold">{l.from === meId ? "Your Companion" : `${name(l.from)}'s`}:</span> {stripCitations(l.say)}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Section>
  );
}

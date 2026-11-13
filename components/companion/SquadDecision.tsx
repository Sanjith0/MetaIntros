"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, MessagesSquare } from "lucide-react";
import { AiLabel, Avatar, Section } from "@/components/fb";
import { stripCitations } from "@/lib/companion/text";
import { CompanionThread, ScorePill, type ThreadLine } from "./CompanionThread";

interface Notes {
  score: number;
  wouldEnjoy: string[];
  concerns: string[];
}
interface Comparison {
  id: string;
  similarity: number;
  reason: string;
}
interface Recap {
  roomSize: number;
  circleTheme: string;
  talkedWith: number;
  squad: { id: string; deep: boolean; notes: Notes | null; thread: ThreadLine[] }[];
  groupChat: { from: string; say: string }[];
  numbers: { similarityPick: { id: string; similarity: number }[]; companionPick: string[]; passedOver: Comparison[]; chosenAnyway: Comparison[]; agreed: number };
}
interface Data {
  me: string;
  /** people outside your squad come back as "Someone nearby" (anonymous) */
  people: Record<string, { name: string; avatarColor: string; anonymous?: boolean }>;
  recap: Recap;
}

/** "How your Companions decided" and "The numbers vs your Companion", once the squad is ready. */
export function SquadDecision({ partyId }: { partyId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/party/${partyId}/companions`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !stop && d?.recap && setData(d))
        .catch(() => {});
    load();
    const t = setTimeout(load, 1500); // the recap is written a moment after the squad locks
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [partyId]);

  if (!data) return null;
  const { me, people, recap } = data;
  const name = (id: string) => (people[id]?.name ?? "Someone").split(" ")[0];
  const shownOpen = open ?? recap.squad[0]?.id ?? null;
  const n = recap.numbers;
  const differs = n.passedOver.length > 0 || n.chosenAnyway.length > 0;

  return (
    <>
      <Section title="How your Companions decided" testId="squad-decision" action={<AiLabel>AI</AiLabel>}>
        <p className="text-body text-muted">
          Your Companion talked with {recap.talkedWith} {recap.talkedWith === 1 ? "person" : "people"} in a group of {recap.roomSize} and settled on this squad. Here&apos;s what it said with each of them.
        </p>
        <ul className="mt-2 divide-y divide-divider">
          {recap.squad.map((s) => {
            const isOpen = shownOpen === s.id;
            return (
              <li key={s.id} data-testid="decision-conversation">
                <button type="button" className="flex min-h-11 w-full items-center gap-3 py-2 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : s.id)}>
                  <Avatar name={people[s.id]?.name ?? "?"} color={people[s.id]?.avatarColor} size={40} />
                  <span className="flex-1 text-body font-semibold">
                    {name(s.id)}
                    {s.deep && <span className="ml-1.5 rounded-full bg-on px-2 text-meta font-semibold text-link">Went deeper</span>}
                  </span>
                  {s.notes && <ScorePill score={s.notes.score} />}
                  <ChevronDown size={18} className={`text-muted transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="space-y-2 pb-3">
                    <CompanionThread lines={s.thread} otherName={name(s.id)} />
                    {s.notes?.wouldEnjoy[0] && <p className="rounded-card bg-wash p-2.5 text-body">Your Companion&apos;s read: {stripCitations(s.notes.wouldEnjoy[0])}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {recap.groupChat.length > 0 && (
          <div className="mt-2 rounded-card bg-wash p-3" data-testid="decision-group">
            <p className="flex items-center gap-1.5 text-body font-semibold"><MessagesSquare size={16} /> The squad&apos;s Companions talked it over</p>
            <ul className="mt-1 space-y-1">
              {recap.groupChat.map((l, i) => (
                <li key={i} className="text-body"><span className="font-semibold">{l.from === me ? "Your Companion" : `${name(l.from)}'s`}:</span> {stripCitations(l.say)}</li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1 text-meta font-semibold text-positive" data-testid="decision-signed">
              <CheckCircle2 size={14} /> All {recap.squad.length + 1} Companions said yes
            </p>
          </div>
        )}
      </Section>

      <Section title="The numbers vs your Companion" testId="numbers-vs-companion">
        <p className="text-body text-muted">
          Most matching apps turn profiles into vectors and pick whoever scores closest. Here&apos;s who that would have picked for you, and what your Companion found by actually talking.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-body">
          <div className="rounded-card bg-wash p-2.5" data-testid="similarity-pick">
            <p className="mb-1 text-meta font-semibold text-muted">Closest by similarity</p>
            {n.similarityPick.map((x) => (
              <p key={x.id} className={`flex justify-between ${n.companionPick.includes(x.id) ? "" : "text-muted line-through"}`}>
                <span>{name(x.id)}</span>
                <span className="tabular-nums">{x.similarity}%</span>
              </p>
            ))}
          </div>
          <div className="rounded-card bg-wash p-2.5" data-testid="companion-pick">
            <p className="mb-1 text-meta font-semibold text-muted">Your Companions chose</p>
            {n.companionPick.map((id) => (
              <p key={id} className={n.similarityPick.some((x) => x.id === id) ? "" : "font-semibold text-link"}>{name(id)}</p>
            ))}
          </div>
        </div>
        {differs ? (
          <ul className="mt-2 space-y-2" data-testid="numbers-differences">
            {n.passedOver.map((x) => (
              <li key={x.id} className="rounded-card border border-divider p-2.5" data-testid="passed-over">
                <p className="text-body font-semibold">{name(x.id)}: {x.similarity}% similar, but not in your squad</p>
                <p className="text-body text-muted">{stripCitations(x.reason)}</p>
              </li>
            ))}
            {n.chosenAnyway.map((x) => (
              <li key={x.id} className="rounded-card border border-divider p-2.5" data-testid="chosen-anyway">
                <p className="text-body font-semibold">{name(x.id)}: only {x.similarity}% similar, but in your squad</p>
                <p className="text-body text-muted">{stripCitations(x.reason)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-body text-muted" data-testid="numbers-agree">
            This time the numbers and your Companions agreed, and your Companions also checked the whole group works together.
          </p>
        )}
      </Section>
    </>
  );
}

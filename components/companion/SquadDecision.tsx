"use client";

import { useEffect, useState } from "react";
import { Bot, Calculator, CheckCircle2, ChevronDown, MessagesSquare, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
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
  people: Record<string, { name: string; avatarColor: string }>;
  recap: Recap;
}

/** "How your Companions decided" and "The numbers vs your Companion" on the Party found screen. */
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
      <section className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-3 text-left" data-testid="squad-decision">
        <h2 className="flex items-center gap-1.5 px-1 font-bold"><Bot size={18} className="text-[#c4b5fd]" /> How your Companions decided</h2>
        <p className="mt-0.5 px-1 text-xs text-[#ddd6fe]">
          Your Companion talked with {recap.talkedWith} {recap.talkedWith === 1 ? "person" : "people"} in a room of {recap.roomSize}, proposed a squad, and signed off on this one. Here&apos;s what it said with each of them.
        </p>
        <ul className="mt-3 space-y-2">
          {recap.squad.map((s) => {
            const isOpen = shownOpen === s.id;
            return (
              <li key={s.id} className="rounded-xl bg-white/8 ring-1 ring-white/10" data-testid="decision-conversation">
                <button type="button" className="flex w-full items-center gap-2.5 p-2.5 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : s.id)}>
                  <Avatar name={people[s.id]?.name ?? "?"} color={people[s.id]?.avatarColor} size={32} />
                  <span className="flex-1 text-sm font-bold">
                    {name(s.id)}
                    {s.deep && <span className="ml-1.5 rounded bg-[#a855f7]/30 px-1.5 text-[9px] font-bold uppercase tracking-wide">went deeper</span>}
                  </span>
                  {s.notes && <ScorePill score={s.notes.score} />}
                  <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="space-y-2 px-2.5 pb-3">
                    <CompanionThread lines={s.thread} otherName={name(s.id)} />
                    {s.notes?.wouldEnjoy[0] && <p className="rounded-lg bg-black/25 p-2 text-xs">👍 Your Companion&apos;s read: {s.notes.wouldEnjoy[0]}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {recap.groupChat.length > 0 && (
          <div className="mt-3 rounded-xl bg-white/8 p-2.5 ring-1 ring-white/10" data-testid="decision-group">
            <p className="flex items-center gap-1.5 text-sm font-bold"><MessagesSquare size={15} /> The squad&apos;s Companions talked it over</p>
            <ul className="mt-1.5 space-y-1">
              {recap.groupChat.map((l, i) => (
                <li key={i} className="text-xs"><span className="font-semibold">{l.from === me ? "Your Companion" : `${name(l.from)}'s`}:</span> {l.say}</li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-200" data-testid="decision-signed">
              <CheckCircle2 size={13} /> All {recap.squad.length + 1} Companions said yes
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-white/15 bg-black/25 p-3 text-left" data-testid="numbers-vs-companion">
        <h2 className="flex items-center gap-1.5 px-1 font-bold"><Calculator size={17} className="text-[#c4b5fd]" /> The numbers vs your Companion</h2>
        <p className="mt-0.5 px-1 text-xs text-[#ddd6fe]">
          Most matching apps turn profiles into vectors and pick whoever scores closest. Here&apos;s who that would have picked for you, and what your Companion found by actually talking.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white/8 p-2" data-testid="similarity-pick">
            <p className="mb-1 font-semibold text-[#c7d2fe]">Closest by similarity</p>
            {n.similarityPick.map((x) => (
              <p key={x.id} className={`flex justify-between ${n.companionPick.includes(x.id) ? "" : "text-rose-200"}`}>
                <span>{name(x.id)}</span>
                <span className="tabular-nums">{x.similarity}%</span>
              </p>
            ))}
          </div>
          <div className="rounded-xl bg-white/8 p-2" data-testid="companion-pick">
            <p className="mb-1 font-semibold text-[#c7d2fe]">Your Companions chose</p>
            {n.companionPick.map((id) => (
              <p key={id} className={n.similarityPick.some((x) => x.id === id) ? "" : "text-emerald-200"}>{name(id)}</p>
            ))}
          </div>
        </div>
        {differs ? (
          <ul className="mt-3 space-y-2 text-xs" data-testid="numbers-differences">
            {n.passedOver.map((x) => (
              <li key={x.id} className="rounded-xl bg-rose-400/10 p-2 ring-1 ring-rose-300/20" data-testid="passed-over">
                <p className="font-semibold">{name(x.id)}: {x.similarity}% similar, but not in your squad</p>
                <p className="text-[#ffe4e6]">{x.reason}</p>
              </li>
            ))}
            {n.chosenAnyway.map((x) => (
              <li key={x.id} className="rounded-xl bg-emerald-400/10 p-2 ring-1 ring-emerald-300/20" data-testid="chosen-anyway">
                <p className="font-semibold">{name(x.id)}: only {x.similarity}% similar, but in your squad</p>
                <p className="text-[#d1fae5]">{x.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[#ddd6fe]" data-testid="numbers-agree">
            <Sparkles size={13} /> This time the numbers and your Companions agreed, and your Companions also checked the whole group works together.
          </p>
        )}
      </section>
    </>
  );
}

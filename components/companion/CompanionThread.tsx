"use client";

import { Bot, ShieldCheck } from "lucide-react";
import { stripCitations } from "@/lib/companion/text";

export interface ThreadLine {
  from: "me" | "them";
  kind: "intro" | "ask" | "answer" | "followup" | "close";
  say: string;
  blocked: boolean;
}

const KIND: Record<ThreadLine["kind"], string> = {
  intro: "introduced",
  ask: "asked",
  answer: "answered",
  followup: "followed up",
  close: "wrapped up",
};

/** One conversation between your Companion and someone else's, on a dark background. */
export function CompanionThread({ lines, otherName }: { lines: ThreadLine[]; otherName: string }) {
  return (
    <ul className="space-y-1.5" data-testid="companion-thread">
      {lines.map((l, i) => {
        const mine = l.from === "me";
        return (
          <li key={i} className={`flex ${mine ? "justify-end" : ""}`} data-testid="companion-line" data-kind={l.kind}>
            <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${mine ? "rounded-br-sm bg-[#7c3aed]/70" : "rounded-bl-sm bg-white/12 ring-1 ring-white/15"}`}>
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#c4b5fd]">
                <Bot size={11} /> {mine ? "Your Companion" : `${otherName}'s Companion`} · {KIND[l.kind]}
              </p>
              <p>{stripCitations(l.say)}</p>
              {l.blocked && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-200" data-testid="line-blocked">
                  <ShieldCheck size={11} /> Safety check replaced a line that would have shared something private
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-emerald-400/20 text-emerald-200" : score >= 50 ? "bg-amber-400/20 text-amber-100" : "bg-rose-400/20 text-rose-100";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`} data-testid="companion-score">{score}</span>;
}

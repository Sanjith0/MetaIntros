"use client";

import { ShieldCheck } from "lucide-react";
import { Bubble } from "@/components/fb";
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

/** One conversation between your Companion and someone else's, drawn as chat bubbles. */
export function CompanionThread({ lines, otherName }: { lines: ThreadLine[]; otherName: string }) {
  return (
    <ul className="space-y-2" data-testid="companion-thread">
      {lines.map((l, i) => {
        const mine = l.from === "me";
        return (
          <li key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid="companion-line" data-kind={l.kind}>
            <span className="mb-0.5 px-3 text-meta text-muted">
              {mine ? "Your Companion" : `${otherName}'s Companion`} {KIND[l.kind]}
            </span>
            <Bubble mine={mine}>{stripCitations(l.say)}</Bubble>
            {l.blocked && (
              <span className="mt-0.5 flex items-center gap-1 px-3 text-meta text-muted" data-testid="line-blocked">
                <ShieldCheck size={12} /> A safety check replaced a line that would have shared something private
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Your Companion's private read on someone, 0-100. */
export function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-on text-link" : "bg-control text-ink";
  return <span className={`rounded-full px-2 py-0.5 text-meta font-semibold tabular-nums ${tone}`} data-testid="companion-score">{score}</span>;
}

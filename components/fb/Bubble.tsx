import type { ReactNode } from "react";
import { cn } from "./cn";

export type RunPos = "single" | "first" | "middle" | "last";

/**
 * Chat bubble. Incoming: bubble-in/ink; outgoing: accent/white. 18px radius, joined corners shrink to 4px
 * on the sender's side inside a run (MESSENGER_CHAT.md §2).
 */
export function Bubble({ mine, pos = "single", children, className }: { mine: boolean; pos?: RunPos; children: ReactNode; className?: string }) {
  const side = mine ? "r" : "l";
  const joined = {
    single: "",
    first: side === "r" ? "rounded-br-[4px]" : "rounded-bl-[4px]",
    middle: side === "r" ? "rounded-tr-[4px] rounded-br-[4px]" : "rounded-tl-[4px] rounded-bl-[4px]",
    last: side === "r" ? "rounded-tr-[4px]" : "rounded-tl-[4px]",
  }[pos];
  return (
    <span className={cn("inline-block max-w-full rounded-bubble px-3 py-2 text-body break-words whitespace-pre-wrap", mine ? "bg-accent text-surface" : "bg-bubble-in text-ink", joined, className)}>
      {children}
    </span>
  );
}

/** Centred 12px grey line: time separators and system messages. */
export function SystemLine({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <li data-testid={testId} className="px-6 py-2 text-center text-[12px] leading-snug text-muted">
      {children}
    </li>
  );
}

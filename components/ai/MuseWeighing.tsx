"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAiStatus } from "./useAiStatus";

/** The real factors the agents' prompts and tools score (see lib/agents + lib/match). */
export const WEIGHING = [
  "Overlapping free time this weekend",
  "Shared interests from likes, groups and music",
  "Mutual friends you already share",
  "Taste clashes from not-interested lists",
  "Distance from everyone to the meetup",
  "Public venues only",
  "Age band and women-only preferences",
  "Events you have both gone to",
];

/**
 * Rotating "what Muse is weighing" line. Honest about timing: it says "is weighing" only while
 * live Muse calls are actually in flight; otherwise it describes what the agents will weigh.
 */
export function MuseWeighing({ dark = false }: { dark?: boolean }) {
  const s = useAiStatus();
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WEIGHING.length), 1800);
    return () => clearInterval(t);
  }, []);
  const live = (s?.pending ?? 0) > 0;
  const noModel = s?.state === "offline" || s?.state === "mock";
  const lead = live ? "Muse is weighing" : noModel ? "When your squad fills, the matcher weighs" : "When your squad fills, Muse weighs";
  return (
    <p data-testid="muse-weighing" data-live={live} className={`flex items-center justify-center gap-1.5 text-xs ${dark ? "text-[#c7d2fe]" : "text-fb-muted"}`}>
      <Sparkles size={13} className={`shrink-0 text-[#a855f7] ${live ? "animate-pulse" : ""}`} />
      <span>
        {lead}:{" "}
        <span key={i} className={`font-semibold animate-[qu-pop_.35s_ease-out] ${dark ? "text-white" : "text-fb-text"}`} data-testid="muse-weighing-item">
          {WEIGHING[i]}
        </span>
      </span>
    </p>
  );
}

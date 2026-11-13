"use client";

import { useState } from "react";
import { Lock, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar, Button, Chip, ListRow } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import type { RatingState } from "@/lib/server/ratings";

type Verdict = "again" | "not_again";
const STAR_WORDS = ["", "Not great", "It was OK", "Good", "Really good", "Loved it"];
const first = (n: string) => n.split(" ")[0];

/**
 * After the squad chat ends: "How was the night?" (1–5) and, per squadmate, "Squad up again?".
 * Private: only Link reads the answers, to tune your next squads and event picks.
 */
export function RateSquadSheet({
  open,
  state,
  onClose,
  onSaved,
}: {
  open: boolean;
  state: RatingState;
  onClose: (skipped: boolean) => void;
  onSaved: (s: RatingState) => void;
}) {
  const [stars, setStars] = useState<number>(state.mine?.stars ?? 0);
  const [mates, setMates] = useState<Record<string, Verdict>>(state.mine?.mates ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const toggle = (id: string, v: Verdict) =>
    setMates((m) => {
      const next = { ...m };
      if (next[id] === v) delete next[id];
      else next[id] = v;
      return next;
    });

  const save = async () => {
    if (!stars || saving) return;
    setSaving(true);
    setError(false);
    const r = await fetch(`/api/squad/${state.partyId}/rating`, { method: "POST", body: JSON.stringify({ stars, mates }) }).catch(() => null);
    setSaving(false);
    if (!r?.ok) return setError(true);
    onSaved({ ...state, mine: { stars, mates }, askNow: false });
  };

  return (
    <Sheet
      open={open}
      onClose={() => onClose(!state.mine)}
      title="How was the night?"
      testId="rate-sheet"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-center text-meta text-badge">Couldn&apos;t save. Try again.</p>}
          <Button variant="primary" size="lg" block disabled={!stars || saving} onClick={save} data-testid="rate-submit">
            {saving ? "Saving…" : "Done"}
          </Button>
          {!state.mine && (
            <Button variant="ghost" block onClick={() => onClose(true)} data-testid="rate-skip">
              Not now
            </Button>
          )}
        </div>
      }
    >
      <div className="px-4">
        <p className="text-body text-muted">{state.eventTitle}</p>
        <div className="mt-3 flex justify-center gap-1" role="radiogroup" aria-label="Rate the night">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}: ${STAR_WORDS[n]}`}
              onClick={() => setStars(n)}
              data-testid={`rate-star-${n}`}
              className="press inline-flex h-11 w-11 items-center justify-center rounded-full"
            >
              <Star size={32} strokeWidth={1.8} className={n <= stars ? "fill-accent text-accent" : "text-disabled"} />
            </button>
          ))}
        </div>
        <p className="mt-1 h-5 text-center text-meta text-muted" data-testid="rate-star-word">{STAR_WORDS[stars]}</p>
      </div>

      {state.mates.length > 0 && (
        <div className="mt-3 border-t border-divider/60 pt-3">
          <h3 className="px-4 text-title font-semibold">Squad up with them again?</h3>
          <p className="px-4 text-meta text-muted">Optional. Skip anyone you like.</p>
          <ul className="mt-1">
            {state.mates.map((m) => {
              const v = mates[m.id];
              return (
                <li key={m.id} data-testid={`rate-mate-${m.id}`} data-verdict={v ?? ""}>
                  <ListRow
                    leading={<Avatar name={m.name} color={m.avatarColor} size={40} />}
                    title={first(m.name)}
                    meta={m.sample ? "Sample person" : undefined}
                    trailing={
                      <span className="flex gap-1.5">
                        <Chip on={v === "again"} onClick={() => toggle(m.id, "again")} aria-label={`Squad up with ${first(m.name)} again`} data-testid={`rate-again-${m.id}`}>
                          <ThumbsUp size={16} aria-hidden /> Yes
                        </Chip>
                        <Chip on={v === "not_again"} onClick={() => toggle(m.id, "not_again")} aria-label={`Don't match me with ${first(m.name)} again`} data-testid={`rate-not-again-${m.id}`}>
                          <ThumbsDown size={16} aria-hidden /> No
                        </Chip>
                      </span>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mx-4 mt-2 flex gap-2 rounded-card bg-wash p-3 text-meta text-muted" data-testid="rate-privacy">
        <Lock size={14} className="mt-px shrink-0" aria-hidden />
        <span>Only Link sees your answers. Nobody is told how you rated them. We use them to pick your next squads and events, and we won&apos;t match you with anyone you said no to.</span>
      </p>
    </Sheet>
  );
}

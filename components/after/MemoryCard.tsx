"use client";

import { useState } from "react";
import type { Feeling, Remembered } from "@/lib/server/memory";

const FEELINGS: { id: Feeling; label: string }[] = [
  { id: "loved", label: "Loved it" },
  { id: "loud", label: "Too loud" },
  { id: "meh", label: "Not my thing" },
];

/** After the night, privately: how the plan was for you, and what your agent may remember. */
export function MemoryCard({ partyId, planTitle, offers, labels, initial }: { partyId: string; planTitle: string; offers: Record<Feeling, Remembered[]>; labels: Record<string, string>; initial: Remembered[] }) {
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [memory, setMemory] = useState<Remembered[]>(initial);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const pick = (f: Feeling) => {
    setFeeling(f);
    setSaved(false);
    setTicked(Object.fromEntries(offers[f].map((o) => [o.tag, true])));
  };
  const save = async () => {
    const r = await fetch("/api/memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, feeling, tags: Object.keys(ticked).filter((t) => ticked[t]) }) });
    if (r.ok) {
      setMemory(((await r.json()) as { memory: Remembered[] }).memory);
      setSaved(true);
      setCleared(false);
    }
  };
  const forget = async () => {
    await fetch("/api/memory", { method: "DELETE" });
    setMemory([]);
    setSaved(false);
    setCleared(true);
  };
  const offer = feeling ? offers[feeling] : [];
  return (
    <section className="mt-4 rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="memory-card">
      <h2 className="text-[17px] font-bold">How was {planTitle} for you?</h2>
      <p className="text-[13px] text-[var(--color-ink-2)]">Only you see this. It&apos;s about the plan, never the people, and it only changes what your own agent suggests next time.</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="How was it">
        {FEELINGS.map((f) => (
          <button key={f.id} onClick={() => pick(f.id)} aria-pressed={feeling === f.id} data-testid={`feeling-${f.id}`} className={`press rounded-full px-3 py-1 text-[14px] font-semibold ${feeling === f.id ? "bg-[var(--color-pq)] text-white" : "bg-[var(--color-btn-2)]"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {feeling && (
        <div className="mt-3">
          {offer.length === 0 ? (
            <p className="text-[14px] text-[var(--color-ink-2)]">Nothing to remember from this one.</p>
          ) : (
            <>
              <div className="text-[14px] font-semibold">Your agent can remember, for next time:</div>
              <ul className="mt-1 space-y-1">
                {offer.map((o) => (
                  <li key={o.tag}>
                    <label className="flex items-center gap-2 text-[14px]">
                      <input type="checkbox" checked={!!ticked[o.tag]} onChange={(e) => setTicked((t) => ({ ...t, [o.tag]: e.target.checked }))} data-testid={`remember-${o.tag}`} />
                      {labels[o.tag] ?? o.tag}
                    </label>
                  </li>
                ))}
              </ul>
              <button onClick={save} data-testid="memory-save" className="press mt-2 rounded-[6px] bg-[var(--color-pq)] px-3 py-1.5 text-[14px] font-semibold text-white">
                Remember these
              </button>
            </>
          )}
        </div>
      )}
      {(memory.length > 0 || saved || cleared) && (
        <div className="mt-3 rounded-[8px] bg-[var(--color-wash)] p-3 text-[14px]" data-testid="memory-now" role="status">
          {memory.length ? (
            <>
              Your agent remembers: {memory.map((m) => labels[m.tag] ?? m.tag).join(", ")}. You&apos;ll see it in your private preview before you join, and can leave it out.
              <button onClick={forget} data-testid="memory-forget" className="ml-1 font-semibold text-[var(--color-link)] hover:underline">
                Make my agent forget
              </button>
            </>
          ) : (
            "Your agent remembers nothing."
          )}
        </div>
      )}
    </section>
  );
}

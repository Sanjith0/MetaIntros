"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";

interface P {
  id: string;
  name: string;
  hue: number;
}

const REASONS = [
  ["uncomfortable", "Made me uncomfortable"],
  ["unsafe", "I felt unsafe"],
  ["no-show", "Didn't show up"],
  ["spam", "Spam or selling something"],
  ["other", "Something else"],
] as const;

/** People from your parties: block, unblock, report. */
export function SafetyPeople({ people, blocked: initialBlocked }: { people: P[]; blocked: string[] }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(new Set(initialBlocked));
  const [reporting, setReporting] = useState<P | null>(null);
  const [reason, setReason] = useState<string>("uncomfortable");
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [done, setDone] = useState<string | null>(null);

  const block = async (id: string, on: boolean) => {
    const r = await fetch("/api/safety/block", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectId: id, on }) });
    if (r.ok) setBlocked(new Set(((await r.json()) as { blocks: string[] }).blocks));
    router.refresh();
  };

  const send = async () => {
    if (!reporting) return;
    const r = await fetch("/api/safety/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectId: reporting.id, reason, note, alsoBlock }) });
    if (r.ok) {
      if (alsoBlock) setBlocked((b) => new Set(b).add(reporting.id));
      setDone(`Thanks. Your report about ${reporting.name.split(" ")[0]} went to the review team.${alsoBlock ? " They're blocked for you." : ""} They aren't told.`);
      setReporting(null);
      setNote("");
    }
  };

  if (!people.length) return <p className="text-[14px] text-[var(--color-ink-2)]">After your first party, the people you met show up here.</p>;

  return (
    <div>
      {done && (
        <div className="mb-3 rounded-[8px] bg-[#e7f6ea] px-3 py-2 text-[14px] text-[#1d6b2f]" data-testid="report-done">
          {done}
        </div>
      )}
      <ul className="divide-y divide-[var(--color-divider)]">
        {people.map((p) => {
          const isBlocked = blocked.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2" data-testid={`safety-person-${p.id}`}>
              <Avatar name={p.name} hue={p.hue} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                {isBlocked && <span className="text-[12px] font-semibold text-[var(--color-badge)]">Blocked</span>}
              </span>
              <button data-testid={`block-${p.id}`} onClick={() => block(p.id, !isBlocked)} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 text-[13px] font-semibold">
                {isBlocked ? "Unblock" : "Block"}
              </button>
              <button data-testid={`report-${p.id}`} onClick={() => (setReporting(p), setDone(null))} className="press rounded-[6px] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-badge)] hover:bg-black/5">
                Report
              </button>
            </li>
          );
        })}
      </ul>

      {reporting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-label="Report">
          <div className="sheet-up w-full max-w-[440px] rounded-[12px] bg-white p-5 shadow-[var(--shadow-elevated)]" data-testid="report-dialog">
            <h2 className="text-[19px] font-bold">Report {reporting.name.split(" ")[0]}</h2>
            <p className="text-[13px] text-[var(--color-ink-2)]">This goes to a person on the review team. {reporting.name.split(" ")[0]} isn't told, and nothing about it shows in the app.</p>
            <fieldset className="mt-3 space-y-1">
              {REASONS.map(([id, label]) => (
                <label key={id} className="flex cursor-pointer items-center gap-2 text-[14px]">
                  <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-[var(--color-pq)]" data-testid={`reason-${id}`} />
                  {label}
                </label>
              ))}
            </fieldset>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Anything else? (optional)" className="mt-3 w-full rounded-[8px] border border-[var(--color-divider)] p-2 text-[14px]" data-testid="report-note" />
            <label className="mt-2 flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="accent-[var(--color-pq)]" />
              Also block {reporting.name.split(" ")[0]}
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={send} data-testid="report-send" className="press flex-1 rounded-[6px] bg-[var(--color-badge)] px-3 py-2 text-[15px] font-semibold text-white">
                Send report
              </button>
              <button onClick={() => setReporting(null)} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-2 text-[15px] font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

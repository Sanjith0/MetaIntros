"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ForgetResult } from "@/lib/server/forget";

const WHERE: Record<string, string> = {
  messages: "a chat message you sent",
  events_log: "the live update that delivered it",
  table: "the table",
  traces: "the projector",
  pairs: "pair talk",
  cards: "a card",
};

/** "Forget my night": a two-step delete, then the scan's result in plain words. */
export function ForgetNight({ partyId, title, done, auto = null }: { partyId: string; title: string; done: boolean; auto?: { at: string; keep: boolean; happened: boolean } | null }) {
  const [keep, setKeep] = useState(auto?.keep ?? false);
  const toggleKeep = async () => {
    const r = await fetch("/api/forget/keep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, keep: !keep }) });
    if (r.ok) setKeep(!keep);
  };
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [result, setResult] = useState<ForgetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setStep("busy");
    const r = await fetch("/api/forget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId }) });
    const j = (await r.json()) as ForgetResult | { error: string };
    if ("error" in j) {
      setError(j.error);
      setStep("idle");
      return;
    }
    setResult(j);
    setStep("idle");
    router.refresh();
  };

  if (result) {
    return (
      <div className="mt-2 space-y-2" data-testid="forget-result" data-found={result.found.length}>
        <p className="text-[15px] font-semibold">
          {result.found.length === 0 ? `Done. Then code read all ${result.checked.toLocaleString("en-US")} values on the server: none hold your words.` : `Done, but ${result.found.length} copies of your words are still on the server:`}
        </p>
        {result.found.length > 0 && (
          <ul className="list-disc pl-5 text-[13px]">
            {result.found.map((f, i) => (
              <li key={i}>
                “{f.text}” in {WHERE[f.where.split(/[.[{]/)[0]!] ?? "the server"}
              </li>
            ))}
          </ul>
        )}
        <div className="text-[13px] text-[var(--color-ink-2)]">
          Removed:{" "}
          <span data-testid="forget-removed">
            {result.removed.map((r) => `${r.label} (${r.count})`).join(", ")}
          </span>
          .
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <p className="mt-2 text-[14px] text-[var(--color-ink-2)]" data-testid="forget-done">
        {auto?.happened
          ? `Your sentence, rules and reasons from ${title} were deleted automatically after the night. They're gone.`
          : `You asked Party Queue to forget your sentence, rules and reasons from ${title}. They're gone.`}
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-2" data-testid="forget">
      <p className="text-[14px] text-[var(--color-ink-2)]">
        Deletes what only you and your agent had from {title}: your sentence and rules, your agent&apos;s private reasons, the exact prompts, code&apos;s checks and your receipt. Kept: what you
        chose to share (your approved lines, your chat messages), the plan and your RSVP.
      </p>
      {auto && (
        <div className="rounded-[8px] bg-[var(--color-wash)] px-3 py-2 text-[14px]" data-testid="forget-auto">
          {keep ? (
            <>You chose to keep it after the night.</>
          ) : (
            <>
              Otherwise it&apos;s deleted automatically when your party chat closes, <b>{auto.at}</b>.
            </>
          )}{" "}
          <button onClick={toggleKeep} data-testid="forget-keep" className="font-semibold text-[var(--color-link)] hover:underline">
            {keep ? "Delete it automatically after all" : "Keep it instead"}
          </button>
        </div>
      )}
      {step === "idle" && (
        <button onClick={() => setStep("confirm")} data-testid="forget-start" className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-2 text-[15px] font-semibold">
          Forget my night
        </button>
      )}
      {step !== "idle" && (
        <div className="rounded-[8px] bg-[var(--color-wash)] p-3" role="group" aria-label="Confirm">
          <p className="text-[14px] font-semibold">This can&apos;t be undone.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={go} disabled={step === "busy"} data-testid="forget-confirm" className="press rounded-[6px] bg-[#c4122f] px-3 py-2 text-[15px] font-semibold text-white disabled:opacity-60">
              {step === "busy" ? "Forgetting…" : "Yes, forget it"}
            </button>
            <button onClick={() => setStep("idle")} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-2 text-[15px] font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-[14px] text-[var(--color-red,#c4122f)]">{error}</p>}
    </div>
  );
}

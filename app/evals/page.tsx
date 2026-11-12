import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvalsBoard } from "@/components/evals/EvalsBoard";
import { flag } from "@/lib/flags";

export const metadata: Metadata = { title: "Evals" };
export const dynamic = "force-dynamic";

export default function EvalsPage() {
  if (!flag("EVALS_PAGE")) notFound();
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-5" data-testid="evals-page">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Evals</div>
        <h1 className="text-[24px] font-bold">Why five agents and a verifier</h1>
        <p className="mt-1 max-w-[760px] text-[15px] text-[var(--color-ink-2)]">
          The same generated parties, four ways. A single prompt sees everyone's private rules when it writes what everyone reads; a verifier stops the words getting out but then
          blocks nearly everything it says; five agents that each see only their own person, plus the verifier, keep rules private and still produce shared lines and openers; a
          code-only solver picks a valid plan but says nothing at all.
        </p>
      </div>
      <EvalsBoard />
      <div className="mt-4 rounded-[12px] bg-white p-4 text-[13px] text-[var(--color-ink-2)] shadow-[var(--shadow-card)]">
        <div className="font-semibold text-[var(--color-ink)]">How to read this</div>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            <b>Simulated</b>: with no model key tonight, the single prompt is a mock that explains its choice using the briefs, the way a summarising prompt tends to. It is given
            perfect planning (the solver's plan), so only privacy differs. The real leak rate of a single prompt is unknown until it is run against the real model.
          </li>
          <li>The five-agent column is the real system end to end, the same code the demo runs. The leak check scans everything each member can load.</li>
          <li>No measure here is about a person or a pair. All of them are about the system.</li>
          <li>
            The full suite (<code className="rounded bg-[var(--color-wash)] px-1">npm run eval -- --mock</code>) adds brief extraction, the judge, grounding and an adversarial
            model. See <code className="rounded bg-[var(--color-wash)] px-1">evals/PLAN.md</code>.
          </li>
        </ul>
      </div>
    </main>
  );
}

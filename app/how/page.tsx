import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchitectureDiagram } from "@/components/how/ArchitectureDiagram";
import { flag } from "@/lib/flags";

export const metadata: Metadata = { title: "How it works" };
export const dynamic = "force-dynamic";

const GUARANTEES: [string, string][] = [
  ["A rejected plan reaches the table only as “unavailable”", "The event's schema has no field for a reason, and every event is validated before it is sent."],
  ["Each phone hears only its own events", "Every event carries an audience; the stream filters by it."],
  ["Public lines come only from approved lines or neutral phrases", "A verifier in code blocks anything else."],
  ["Code beats the model on every hard rule", "End time, budget, drink minimum and public venue are checked after every turn."],
  ["Every machine-written sentence maps to an approved fact", "In pair talk the model picks ids; code writes the sentence."],
  ["No third person is named without opting in", "“You have a friend in common” unless that friend is in the party and agreed."],
  ["Nothing is inferred from a face", "The door can only name a party member who opted in, or nobody."],
];

export default function HowPage() {
  if (!flag("HOW_PAGE")) notFound();
  return (
    <main className="mx-auto max-w-[1100px] space-y-4 px-4 py-5" data-testid="how-page">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · How it works</div>
        <h1 className="text-[24px] font-bold">Each agent knows one person. Code holds the line.</h1>
        <p className="mt-1 max-w-[760px] text-[15px] text-[var(--color-ink-2)]">
          One sentence becomes a private brief on your phone. Five agents, each knowing only its own person, settle the plan at a shared table. Code judges every turn, checks every public line, and
          tells all five phones at once.
        </p>
      </div>
      <section className="overflow-x-auto rounded-[12px] bg-white p-3 shadow-[var(--shadow-card)]" role="region" aria-label="Architecture diagram" tabIndex={0}>
        <div className="min-w-[720px]">
          <ArchitectureDiagram />
        </div>
      </section>
      <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="how-guarantees">
        <h2 className="text-[17px] font-bold">What code guarantees</h2>
        <ul className="mt-2 space-y-2">
          {GUARANTEES.map(([t, d]) => (
            <li key={t}>
              <div className="text-[15px] font-semibold">{t}</div>
              <div className="text-[13px] text-[var(--color-ink-2)]">{d}</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-[var(--color-ink-2)]">
          Each guarantee has a test. See <Link href="/evals" className="font-semibold text-[var(--color-link)]">the leak test</Link> for the evidence, and{" "}
          <code className="rounded bg-[var(--color-wash)] px-1">docs/ARCHITECTURE.md</code> for where each one lives in the code.
        </p>
      </section>
    </main>
  );
}

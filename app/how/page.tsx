import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchitectureDiagram } from "@/components/how/ArchitectureDiagram";
import { flag } from "@/lib/flags";
import { GUARANTEES } from "@/lib/how";

export const metadata: Metadata = { title: "How it works" };
export const dynamic = "force-dynamic";

export default function HowPage() {
  if (!flag("HOW_PAGE")) notFound();
  const hub = flag("PROOF_HUB");
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
        <h2 className="text-[17px] font-bold">{hub ? "What code guarantees, and where to check" : "What code guarantees"}</h2>
        {hub && <p className="text-[13px] text-[var(--color-ink-2)]">Don&apos;t take our word for it: each one can be seen working in the app, and each has a test.</p>}
        <ul className="mt-2 divide-y divide-[var(--color-divider)]">
          {GUARANTEES.map((g, i) => (
            <li key={g.title} className="grid gap-1 py-2.5 sm:grid-cols-[1fr_auto] sm:gap-4" data-testid={`guarantee-${i}`}>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{g.title}</div>
                <div className="text-[13px] text-[var(--color-ink-2)]">{g.how}</div>
                {hub && <code className="mt-0.5 inline-block rounded bg-[var(--color-wash)] px-1 text-[12px] text-[var(--color-ink-2)]">{g.test}</code>}
              </div>
              {hub && (
                <Link
                  href={g.see.href}
                  className="press self-start rounded-[6px] sm:whitespace-nowrap bg-[var(--color-pq-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-pq-ink)]"
                  data-testid="guarantee-see"
                >
                  See it: {g.see.label} →
                </Link>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-[var(--color-ink-2)]">
          The same claims across 25 generated parties:{" "}
          <Link href="/evals" className="font-semibold text-[var(--color-link)]">
            the leak test
          </Link>
          . Where each one lives in the code: <code className="rounded bg-[var(--color-wash)] px-1">docs/ARCHITECTURE.md</code>.
        </p>
      </section>
    </main>
  );
}

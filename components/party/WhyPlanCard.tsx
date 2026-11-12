import { IconCheck, IconClose } from "@/components/icons";
import type { WhyView } from "@/lib/server/why";

/** Why this plan, from code checks only. */
export function WhyPlanCard({ v }: { v: WhyView }) {
  return (
    <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="why-plan">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold">Why {v.planTitle}</h2>
        <span className="whitespace-nowrap rounded bg-[var(--color-wash)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">From code checks</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {v.lines.map((l) => (
          <li key={l.id} className="flex items-start gap-2 text-[14px]" data-testid={`why-${l.id}`}>
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${l.ok ? "bg-[var(--color-positive)] text-white" : "bg-[var(--color-btn-2)] text-[var(--color-ink-2)]"}`}>
              {l.ok ? <IconCheck size={12} /> : <IconClose size={10} />}
            </span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-[var(--color-ink-2)]">No model wrote this card. Each line comes from the judge's checks, the plan's details, or the signatures.</p>
    </section>
  );
}

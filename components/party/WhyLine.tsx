import type { SourceItem } from "@/lib/stage/provenance";

/** "Why this?" under a machine-written line: its sources in plain words. No script needed (details/summary). */
export function WhyLine({ items, testid = "why-line" }: { items: SourceItem[]; testid?: string }) {
  if (!items.length) return null;
  return (
    <details className="group mt-1 text-[13px]" data-testid={testid}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-[var(--color-link)] [&::-webkit-details-marker]:hidden">
        Why this?
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="mt-1 rounded-[8px] bg-[var(--color-wash)] px-2.5 py-2 text-[var(--color-ink-2)]">
        <div className="font-semibold text-[var(--color-ink)]">Code wrote this from:</div>
        <ul className="mt-0.5 list-disc space-y-0.5 pl-4" data-testid={`${testid}-items`}>
          {items.map((it, i) => (
            <li key={i}>{it.text}</li>
          ))}
        </ul>
        <div className="mt-1 text-[12px]">The model only chose which facts. Nothing else about anyone was used.</div>
      </div>
    </details>
  );
}

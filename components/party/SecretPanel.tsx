import { IconCheck, IconLock } from "@/components/icons";
import type { SecretView } from "@/lib/server/secret";

/** Your private rules and receipt, next to what the party actually knows.
 *  The right column is computed by a leak scan, so "nothing" is a result. */
export function SecretPanel({ v }: { v: SecretView }) {
  const leaked = v.partyKnows.length > 0;
  return (
    <section className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-card)]" data-testid="secret-panel">
      <div className="grid grid-cols-2 divide-x divide-[var(--color-divider)]">
        {/* Left: only on this phone */}
        <div className="min-w-0 p-3 sm:p-4" data-testid="secret-mine">
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink)]">
            <IconLock size={14} /> Only on your phone
          </div>
          <div className="mt-2 text-[12px] font-semibold text-[var(--color-ink-3)]">Your rules</div>
          {v.rules.length === 0 ? (
            <div className="text-[13px] text-[var(--color-ink-2)]">You didn't set any.</div>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {v.rules.map((r) => (
                <li key={r.id} data-testid="secret-rule">
                  <span className="inline-block rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[12px] font-semibold text-white">{r.label}</span>
                  <div className="mt-0.5 text-[12px] italic text-[var(--color-ink-2)]">“{r.yourWords}”</div>
                </li>
              ))}
            </ul>
          )}
          {v.turnedDown.length > 0 && (
            <>
              <div className="mt-3 text-[12px] font-semibold text-[var(--color-ink-3)]">Your agent turned down</div>
              <ul className="mt-1 space-y-1">
                {v.turnedDown.map((t) => (
                  <li key={t.planId} className="text-[12px] leading-snug">
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-[var(--color-ink-2)]"> · {t.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Right: what the other four can see, from a scan */}
        <div className={`min-w-0 p-3 sm:p-4 ${leaked ? "bg-[#fdecef]" : "bg-[var(--color-wash)]"}`} data-testid="secret-party-knows" data-leaks={v.partyKnows.length}>
          <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink)]">What the party knows</div>
          {leaked ? (
            <ul className="mt-2 space-y-1">
              {v.partyKnows.map((k, i) => (
                <li key={i} className="text-[12px] font-semibold text-[var(--color-badge)]">
                  {k.memberName} can see “{k.text}”
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2" data-testid="secret-empty">
              <div className="flex min-h-[56px] items-center justify-center rounded-[8px] border-2 border-dashed border-[var(--color-divider)] text-[13px] font-semibold text-[var(--color-ink-2)]">
                Nothing
              </div>
              <div className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-[var(--color-ink-2)]">
                <IconCheck size={14} className="mt-px shrink-0 text-[var(--color-positive)]" />
                <span>
                  Checked just now: {v.checkedItems} items across all {v.checkedMembers} other phones. None mention your rules or reasons.
                </span>
              </div>
            </div>
          )}
          {v.partySaw.length > 0 && (
            <>
              <div className="mt-3 text-[12px] font-semibold text-[var(--color-ink-3)]">They saw only</div>
              <ul className="mt-1 space-y-0.5">
                {v.partySaw.map((t) => (
                  <li key={t} className="text-[12px] text-[var(--color-ink-2)]">
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-[11px] text-[var(--color-ink-2)]">No name, no reason.</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

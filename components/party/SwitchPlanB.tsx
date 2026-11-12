"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SwitchState } from "@/lib/server/switchplan";

/** Ask to switch to plan B. The count is shown; who asked never is. */
export function SwitchPlanB({ partyId, initial }: { partyId: string; initial: SwitchState }) {
  const router = useRouter();
  const [st, setSt] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const ask = async () => {
    setError(null);
    const r = await fetch("/api/party/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId }) });
    const body = (await r.json()) as { error?: string; switched?: boolean; state?: SwitchState | null };
    if (!r.ok) {
      setError(body.error ?? "Couldn't ask.");
      return;
    }
    if (body.switched) router.refresh();
    else if (body.state) setSt(body.state);
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]" data-testid="switch-b">
      {st.mine ? (
        <span className="font-semibold text-[var(--color-ink-2)]" data-testid="switch-b-asked">
          You asked · {st.votes} of {st.needed} needed
        </span>
      ) : (
        <button onClick={ask} data-testid="switch-b-ask" className="press rounded-[6px] bg-[var(--color-btn-2)] px-2.5 py-1 font-semibold">
          Switch to plan B{st.votes ? ` (${st.votes} of ${st.needed} asked)` : ""}
        </button>
      )}
      {error && <span className="text-[#a8132d]">{error}</span>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Leave before the plan is set. The others are told the party changed, never who left. */
export function LeaveParty({ partyId }: { partyId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    setBusy(true);
    const r = await fetch("/api/party/leave", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId }) });
    setBusy(false);
    if (r.ok) router.push("/party?left=1");
  };
  if (!confirm)
    return (
      <button data-testid="leave-party" onClick={() => setConfirm(true)} className="text-[13px] font-semibold text-[var(--color-ink-2)] hover:underline">
        Leave this party
      </button>
    );
  return (
    <div className="rounded-[8px] bg-[var(--color-wash)] p-3 text-[13px]" data-testid="leave-confirm">
      <div className="font-semibold">Leave before the plan is set?</div>
      <div className="text-[var(--color-ink-2)]">The other four go back to the front of the queue. They won't be told who left.</div>
      <div className="mt-2 flex gap-2">
        <button disabled={busy} data-testid="leave-yes" onClick={leave} className="press rounded-[6px] bg-[var(--color-ink)] px-3 py-1.5 font-semibold text-white">
          Leave
        </button>
        <button onClick={() => setConfirm(false)} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 font-semibold">
          Stay
        </button>
      </div>
    </div>
  );
}

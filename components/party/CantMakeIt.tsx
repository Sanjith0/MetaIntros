"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** After the plan is set: can't make it. The plan stands; the others aren't told who. */
export function CantMakeIt({ partyId }: { partyId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const r = await fetch("/api/party/cantmakeit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId }) });
    setBusy(false);
    if (r.ok) router.push("/party?cantmake=1");
    else setError(((await r.json()) as { error?: string }).error ?? "Couldn't send.");
  };
  if (!confirm)
    return (
      <button data-testid="cant-make-it" onClick={() => setConfirm(true)} className="text-[13px] font-semibold text-[var(--color-ink-2)] hover:underline">
        Can&apos;t make it?
      </button>
    );
  return (
    <div className="rounded-[8px] bg-[var(--color-wash)] p-3 text-[13px]" data-testid="cant-confirm">
      <div className="font-semibold">Can&apos;t make it tonight?</div>
      <div className="text-[var(--color-ink-2)]">The plan stands. If someone waiting nearby fits it, they take your seat. The others are told one person couldn&apos;t make it, not who. You don&apos;t owe anyone a reason.</div>
      <div className="mt-2 flex gap-2">
        <button disabled={busy} data-testid="cant-yes" onClick={go} className="press rounded-[6px] bg-[var(--color-ink)] px-3 py-1.5 font-semibold text-white">
          I can&apos;t make it
        </button>
        <button onClick={() => setConfirm(false)} className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 font-semibold">
          I&apos;m still going
        </button>
      </div>
      {error && <p className="mt-1 text-[#a8132d]">{error}</p>}
    </div>
  );
}

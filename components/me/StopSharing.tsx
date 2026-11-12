"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Stop sharing one fact: everything built from it is rewritten for everyone. */
export function StopSharing({ facts }: { facts: { id: string; tag: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const stop = async (id: string, tag: string) => {
    const r = await fetch("/api/me/revoke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ factId: id }) });
    const body = (await r.json()) as { error?: string; rewritten?: { cards: number; messages: number; pairs: number; table: number } };
    if (!r.ok) {
      setMsg(body.error ?? "Couldn't stop sharing.");
      return;
    }
    const w = body.rewritten!;
    setMsg(`Stopped sharing “${tag}”. Rewritten: ${w.cards} cards, ${w.messages + w.pairs + w.table} lines.`);
    router.refresh();
  };
  return (
    <div className="mt-2" data-testid="stop-sharing">
      <ul className="space-y-1">
        {facts.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 text-[14px]">
            <span>{f.tag}</span>
            <button onClick={() => stop(f.id, f.tag)} data-testid={`stop-${f.id}`} className="press rounded-[6px] bg-[var(--color-btn-2)] px-2.5 py-1 text-[13px] font-semibold">
              Stop sharing
            </button>
          </li>
        ))}
      </ul>
      {msg && (
        <p className="mt-2 text-[13px] font-semibold text-[var(--color-ink-2)]" role="status" data-testid="stop-sharing-msg">
          {msg}
        </p>
      )}
    </div>
  );
}

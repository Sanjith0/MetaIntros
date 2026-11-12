"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FastForward } from "lucide-react";

export function FastForwardButton({ label = "Fast-forward time" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} data-testid="fast-forward"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/demo/fast-forward", { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-fb-divider py-1.5 text-xs font-semibold text-fb-muted">
      <FastForward size={14} /> {busy ? "Jumping ahead…" : `Demo: ${label} (past the event)`}
    </button>
  );
}

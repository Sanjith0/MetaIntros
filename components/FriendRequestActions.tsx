"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FriendRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (accept: boolean) => {
    setBusy(true);
    await fetch("/api/friends/respond", { method: "POST", body: JSON.stringify({ requestId, accept }) });
    router.refresh();
  };
  return (
    <span className="mt-1 flex gap-2">
      <button disabled={busy} onClick={() => act(true)} data-testid="request-confirm" className="flex-1 rounded-lg bg-fb-blue py-1.5 font-semibold text-white">Confirm</button>
      <button disabled={busy} onClick={() => act(false)} data-testid="request-delete" className="flex-1 rounded-lg bg-[#e4e6eb] py-1.5 font-semibold">Delete</button>
    </span>
  );
}

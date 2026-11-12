"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/fb";

export function FriendRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (accept: boolean) => {
    setBusy(true);
    await fetch("/api/friends/respond", { method: "POST", body: JSON.stringify({ requestId, accept }) });
    router.refresh();
  };
  return (
    <span className="mt-2 flex gap-2">
      <Button variant="primary" className="flex-1" disabled={busy} onClick={() => act(true)} data-testid="request-confirm">Confirm</Button>
      <Button className="flex-1" disabled={busy} onClick={() => act(false)} data-testid="request-delete">Delete</Button>
    </span>
  );
}

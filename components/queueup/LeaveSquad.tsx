"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button, IconCircle, ListRow } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";

/**
 * "Leave squad" on Squad info, like Messenger's "Leave chat": a row that opens a confirm sheet.
 * You leave the squad chat and the plan; the others see that you left, never why.
 */
export function LeaveSquad({ partyId }: { partyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const leave = async () => {
    setBusy(true);
    setError(false);
    const r = await fetch(`/api/squad/${partyId}/leave`, { method: "POST" }).catch(() => null);
    if (r?.ok) {
      router.push("/events");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(true);
  };
  return (
    <>
      <ListRow onClick={() => setOpen(true)} testId="leave-squad" leading={<IconCircle><LogOut size={18} /></IconCircle>} title="Leave squad" subtitle="Leave the chat and the plan. Nobody is told why." />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Leave this squad?"
        testId="leave-squad-sheet"
        footer={
          <Button size="lg" block disabled={busy} onClick={leave} data-testid="leave-squad-confirm" icon={<LogOut size={16} />}>
            {error ? "Try again" : "Leave squad"}
          </Button>
        }
      >
        <p className="px-4 text-body">
          You&apos;ll leave the squad and its chat. The others see that you left, not why. You can find a new squad any time.
        </p>
        {error && <p role="alert" className="px-4 pt-2 text-meta text-badge">Couldn&apos;t leave the squad.</p>}
      </Sheet>
    </>
  );
}

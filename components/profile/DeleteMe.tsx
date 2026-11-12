"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/fb";

/** For live sign-ups only: delete everything now (what /join promises), or just sign out. */
export function DeleteMe() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (forget: boolean) => {
    setBusy(true);
    await fetch(`/api/signup${forget ? "?forget=1" : ""}`, { method: "DELETE" }).catch(() => {});
    router.push(forget ? "/join" : "/events");
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      {confirm ? (
        <>
          <p className="text-body">This deletes your demo profile, interests, squad memberships and requests now. Messages you sent stay in their chats without your name.</p>
          <Button block className="text-badge" disabled={busy} onClick={() => go(true)} data-testid="delete-me-confirm" icon={<Trash2 size={16} />}>Delete my demo data</Button>
          <Button variant="ghost" block onClick={() => setConfirm(false)}>Cancel</Button>
        </>
      ) : (
        <>
          <Button block onClick={() => setConfirm(true)} data-testid="delete-me" icon={<Trash2 size={16} />}>Delete my demo data now</Button>
          <Button variant="ghost" block disabled={busy} onClick={() => go(false)} icon={<LogOut size={16} />}>Sign out</Button>
        </>
      )}
    </div>
  );
}

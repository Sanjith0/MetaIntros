"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye } from "lucide-react";
import { IconCircle } from "@/components/fb";

/** Profile setting: "Let friends see when I'm queuing". Off until you turn it on. */
export function QueueVisibilityToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const change = async (v: boolean) => {
    setOn(v);
    setBusy(true);
    const r = await fetch("/api/me/queue-visibility", { method: "POST", body: JSON.stringify({ visibility: v ? "friends" : "off" }) }).catch(() => null);
    if (!r?.ok) setOn(!v);
    setBusy(false);
    router.refresh();
  };
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-2" data-testid="profile-queue-visibility">
      <IconCircle><Eye size={18} /></IconCircle>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">Let friends see when I&apos;m queuing</span>
        <span className="block text-meta text-muted">{on ? "Friends see which event and area. Never who else is in line." : "Off. Nobody sees your queues."}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={busy}
        onChange={(e) => change(e.target.checked)}
        data-testid="profile-queue-visibility-toggle"
        className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-control transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-surface before:shadow before:transition-transform checked:bg-accent checked:before:translate-x-[18px]"
      />
    </label>
  );
}

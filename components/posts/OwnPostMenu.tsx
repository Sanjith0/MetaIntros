"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";

/** "…" on your own post or story: delete it. */
export function OwnPostMenu({ postId, kind }: { postId: string; kind: "post" | "story" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    await fetch(`/api/posts/${postId}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Options for your ${kind}`} className="press -mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-press" data-testid="own-post-menu">
        <MoreHorizontal size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={kind === "story" ? "Your story" : "Your post"}>
        <div className="px-4 pb-2">
          <Button block icon={<Trash2 size={16} />} disabled={busy} onClick={remove} data-testid="delete-post">
            Delete {kind}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

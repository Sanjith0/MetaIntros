"use client";

import { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { Button, Chip, IconCircle, ListRow } from "@/components/fb";
import { Composer } from "@/components/fb/Composer";
import { Sheet } from "@/components/fb/Sheet";
import { useToast } from "@/components/fb/Toast";

/** The interactive parts of /design: Sheet, Toast, a toggle Chip and the Composer, working for real. */
export function GalleryDemos() {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(false);
  const [size, setSize] = useState(5);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const toast = useToast();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)} data-testid="spec-open-sheet">
          Open a sheet
        </Button>
        <Button onClick={() => toast("Saved to your squad album", { label: "View", href: "#spec-feedback" })} data-testid="spec-show-toast">
          Show a toast
        </Button>
        <Chip on={on} onClick={() => setOn((v) => !v)} data-testid="spec-chip-toggle">
          Interested
        </Chip>
      </div>
      <div className="overflow-hidden rounded-card border border-divider">
        {sent.length > 0 && <p className="px-3 pt-2 text-meta text-muted">Sent: {sent.join(" · ")}</p>}
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => {
            if (!draft.trim()) return;
            setSent((s) => [...s.slice(-2), draft.trim()]);
            setDraft("");
          }}
        />
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Indie Night"
        testId="spec-sheet"
        footer={
          <Button variant="primary" size="lg" block onClick={() => setOpen(false)}>
            Find my squad
          </Button>
        }
      >
        <div className="px-4">
          <p className="text-body font-semibold">Squad size</p>
          <div className="mt-1.5 flex gap-2">
            {[4, 5, 6].map((n) => (
              <Chip key={n} on={size === n} onClick={() => setSize(n)}>
                {n} people
              </Chip>
            ))}
          </div>
        </div>
        <ListRow
          leading={<IconCircle><MapPin size={20} /></IconCircle>}
          title="Choose an area instead"
          trailing={<ChevronRight size={20} className="text-muted" />}
          onClick={() => setOpen(false)}
        />
      </Sheet>
    </div>
  );
}

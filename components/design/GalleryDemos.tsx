"use client";

import { useState } from "react";
import { Calendar, ChevronRight, Users } from "lucide-react";
import { Button, Chip, IconCircle, ListRow } from "@/components/fb";
import { Composer } from "@/components/fb/Composer";
import { Sheet } from "@/components/fb/Sheet";
import { useToast } from "@/components/fb/Toast";

/** The interactive parts of /design: Sheet, Toast, a toggle Chip and the Composer, working for real. */
export function GalleryDemos() {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(false);
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
          {on ? "Interested" : "Not interested"}
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
        title="Find a squad"
        testId="spec-sheet"
        footer={
          <Button variant="primary" size="lg" block onClick={() => setOpen(false)}>
            Find my squad
          </Button>
        }
      >
        <ListRow
          leading={<IconCircle><Calendar size={20} /></IconCircle>}
          title="For an event you pick"
          subtitle="Your squad goes to that event together."
          trailing={<ChevronRight size={20} className="text-muted" />}
          onClick={() => setOpen(false)}
        />
        <ListRow
          leading={<IconCircle><Users size={20} /></IconCircle>}
          title="For a new hangout"
          subtitle="We plan one at a public spot near all of you."
          trailing={<ChevronRight size={20} className="text-muted" />}
          onClick={() => setOpen(false)}
        />
      </Sheet>
    </div>
  );
}

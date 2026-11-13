"use client";

import { useState } from "react";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, MapPinned, Users } from "lucide-react";
import { Button, IconCircle, ListRow } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import { DateLine } from "@/components/events/DateLine";
import { QueueSetup, type SetupEvent } from "@/components/queue/QueueSetup";

export interface PickableEvent extends SetupEvent { mine?: boolean }
type Landmark = { id: string; name: string; city: string };
type Step = { kind: "modes" } | { kind: "pick" } | { kind: "setup"; mode: "events" | "hangout"; event: SetupEvent | null };

/**
 * "Go with a squad": one native feed unit with one primary button. It opens a two-step sheet:
 * step 1 = the event queue modes as rows, step 2 = setup (size, where, one safety line, Find my squad).
 * On an event page (`event` set) the sheet opens straight at step 2 for that event.
 * On the Events tab a second, grey "Plan a new hangout" button opens step 2 for a new hangout directly.
 */
export function QueueEntry({ pulse, events = [], event, landmarks, shareDefault = false, friendsInLine = 0, again = false, also = false, autoOpen = false }: { pulse: string | null; events?: PickableEvent[]; event?: SetupEvent; landmarks: Landmark[]; shareDefault?: boolean; friendsInLine?: number; /** shown under a finished squad's card: quieter copy, grey button (one primary per screen) */ again?: boolean; /** shown under an active squad's card: you can be in more than one squad; grey buttons */ also?: boolean; /** open the sheet on arrival (the event page's "Find another squad" links here) */ autoOpen?: boolean }) {
  const first: Step = event ? { kind: "setup", mode: "events", event } : { kind: "modes" };
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState<Step>(first);
  const openAt = (s: Step) => {
    setStep(s);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setStep(first);
  };
  const title = step.kind === "modes" ? "Find a squad" : step.kind === "pick" ? "Pick an event" : step.event ? step.event.title : step.mode === "hangout" ? "Plan a new hangout" : "Any event this weekend";
  const sorted = [...events].sort((a, b) => Number(Boolean(b.mine)) - Number(Boolean(a.mine)));

  return (
    <section className="bg-surface px-4 py-3" data-testid="queue-entry">
      <div className="flex items-center gap-3">
        <IconCircle tone="on" size={40}><Users size={20} /></IconCircle>
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold">{again ? "Up for another one?" : also ? "Go with another squad" : event ? "Going alone? Go with a squad" : "Go with a squad"}</h2>
          {/* One line at most: who's in line. What a squad is, the title and the button already say. */}
          {friendsInLine > 0 ? (
            <p className="text-meta font-semibold text-link" data-testid="friends-in-line">
              {friendsInLine === 1 ? "1 friend is" : `${friendsInLine} friends are`} in line for this
            </p>
          ) : (
            pulse && <p className="text-meta text-muted" data-testid="queue-pulse">{pulse}</p>
          )}
        </div>
      </div>
      <Button variant={again || also ? "secondary" : "primary"} block className="mt-3" data-testid={event ? "queue-up-button" : "queue-entry-open"} onClick={() => openAt(first)}>
        {again || also ? "Find another squad for an event" : event ? "Find a squad to go with" : "Find a squad for an event"}
      </Button>
      {!event && (
        <Button block className="mt-2" data-testid="queue-entry-hangout" icon={<MapPinned size={16} />} onClick={() => openAt({ kind: "setup", mode: "hangout", event: null })}>
          Plan a new hangout
        </Button>
      )}

      <Sheet open={open} onClose={close} title={title} testId="queue-sheet">
        {step.kind !== "modes" && !event && !(step.kind === "setup" && step.mode === "hangout") && (
          <button type="button" onClick={() => setStep(step.kind === "setup" && step.event ? { kind: "pick" } : { kind: "modes" })} className="-mt-1 mb-1 flex items-center gap-1 px-4 text-meta font-semibold text-link">
            <ChevronLeft size={16} aria-hidden /> Back
          </button>
        )}
        {step.kind === "modes" && (
          <ul className="pb-2">
            <li>
              <ListRow onClick={() => setStep({ kind: "pick" })} testId="queue-pick-event" leading={<IconCircle><CalendarCheck size={20} /></IconCircle>} title="Pick an event" trailing={<ChevronRight size={20} className="text-muted" aria-hidden />} />
            </li>
            <li>
              <ListRow onClick={() => setStep({ kind: "setup", mode: "events", event: null })} testId="queue-anything" leading={<IconCircle><CalendarDays size={20} /></IconCircle>} title="Any event this weekend" subtitle="We pick one you'll all like" trailing={<ChevronRight size={20} className="text-muted" aria-hidden />} />
            </li>
          </ul>
        )}
        {step.kind === "pick" && (
          <ul className="pb-2" data-testid="queue-event-list">
            {sorted.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setStep({ kind: "setup", mode: "events", event: e })} data-testid={`queue-event-${e.id}`} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-press active:bg-wash">
                  <span className="min-w-0 flex-1">
                    <DateLine start={new Date(e.startsAt)} />
                    <span className="block truncate text-body font-semibold">{e.title}</span>
                    <span className="block truncate text-meta text-muted">{e.mine ? "You're interested · " : ""}{e.venue}</span>
                  </span>
                  <ChevronRight size={20} className="text-muted" aria-hidden />
                </button>
              </li>
            ))}
            {sorted.length === 0 && <li className="px-4 py-6 text-center text-muted">No public events coming up.</li>}
          </ul>
        )}
        {step.kind === "setup" && <QueueSetup variant="sheet" mode={step.mode} event={step.event} landmarks={landmarks} shareDefault={shareDefault} />}
      </Sheet>
    </section>
  );
}

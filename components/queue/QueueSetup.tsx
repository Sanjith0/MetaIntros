"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronRight, Crosshair, Lock, MapPin, MapPinned, ShieldCheck } from "lucide-react";
import { Button, Chip, IconCircle, ListRow } from "@/components/fb";
import { DateLine } from "@/components/events/DateLine";

type Mode = "events" | "hangout";

export interface SetupEvent { id: string; title: string; startsAt: string; venue: string; isPublic: boolean }

interface Props {
  mode?: Mode;
  event: SetupEvent | null;
  landmarks: { id: string; name: string; city: string }[];
  /** "page" = /queue/start; "sheet" = inside the event page's bottom sheet */
  variant?: "page" | "sheet";
}

type LocState = { kind: "idle" } | { kind: "locating" } | { kind: "manual"; reason: string };

/**
 * Squad sizes offered. The engine supports 2–8; the council (SYNTHESIS §5) recommended 4–6: 2 reads as a
 * date, 3 becomes two-and-one, 7–8 splits into two conversations. Open decision, one line to change.
 */
export const SIZES = [4, 5, 6] as const;
export const DEFAULT_SIZE = 5;

function getPosition(timeoutMs = 6000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 });
  });
}

const ERRORS: Record<string, string> = {
  private_event: "Queue Up only works for events at public venues.",
  age: "Queue Up is for people 18 and over.",
};

export function QueueSetup({ event, landmarks, mode: initialMode = "events", variant = "page" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(event ? "events" : initialMode);
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [loc, setLoc] = useState<LocState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/queue/join", {
      method: "POST",
      body: JSON.stringify({ mode, eventId: mode === "events" ? event?.id ?? null : null, targetSize: size, ...body }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { error: "network" };
    if (j.ok) return router.push("/queue");
    setBusy(false);
    if (j.error === "too_far") setLoc({ kind: "manual", reason: "You look far from our Queue Up areas. Pick where you'll meet:" });
    else setError(ERRORS[j.error] ?? "Couldn't join the queue. Try again.");
  };

  const findSquad = async () => {
    // Joining triggers the browser's location prompt; any failure → manual pick.
    setLoc({ kind: "locating" });
    try {
      const pos = await getPosition();
      await join({ lat: pos.coords.latitude, lng: pos.coords.longitude, locationSource: "gps" });
    } catch {
      setLoc({ kind: "manual", reason: "Location is off. Choose your area instead:" });
    }
  };

  if (event && !event.isPublic)
    return (
      <p data-testid="queue-setup" className="flex items-center gap-2 bg-surface p-4 text-muted">
        <Lock size={16} aria-hidden /> Queue Up only works for events at public venues.
      </p>
    );

  return (
    <div data-testid="queue-setup" className="bg-surface">
      {variant === "page" && (
        <div className="px-4 pt-3">
          {event ? (
            <>
              <DateLine start={new Date(event.startsAt)} />
              <h2 className="text-headline font-bold" data-testid="queue-title">{event.title}</h2>
              <p className="text-meta text-muted">{event.venue}</p>
            </>
          ) : (
            <>
              <h2 className="text-headline font-bold" data-testid="queue-title">{mode === "hangout" ? "Plan a new hangout" : "Any event this weekend"}</h2>
              <p className="text-body text-muted">
                {mode === "hangout"
                  ? "We'll match your squad, then plan a hangout at a public spot near all of you, when you're all free."
                  : "We'll match your squad, then pick an existing event you'll all like."}
              </p>
            </>
          )}
        </div>
      )}
      {variant === "sheet" && (
        <h3 className="sr-only" data-testid="queue-title">{event ? event.title : mode === "hangout" ? "Plan a new hangout" : "Any event this weekend"}</h3>
      )}
      {variant === "sheet" && !event && (
        <p className="px-4 text-body text-muted">
          {mode === "hangout" ? "We'll match your squad, then plan a hangout at a public spot near all of you, when you're all free." : "We'll match your squad, then pick an existing event you'll all like."}
        </p>
      )}

      {!event && variant === "page" && (
        <div className="mt-3 flex gap-2 px-4" role="radiogroup" aria-label="Queue for">
          <Chip on={mode === "events"} role="radio" aria-checked={mode === "events"} data-testid="queue-mode-events" onClick={() => setMode("events")}>
            <CalendarDays size={16} aria-hidden /> Any event
          </Chip>
          <Chip on={mode === "hangout"} role="radio" aria-checked={mode === "hangout"} data-testid="queue-mode-hangout" onClick={() => setMode("hangout")}>
            <MapPinned size={16} aria-hidden /> New hangout
          </Chip>
        </div>
      )}

      <section className={variant === "page" ? "mt-4 px-4" : "mt-2 px-4"} aria-labelledby="size-label">
        <h3 id="size-label" className="text-body font-semibold">Squad size</h3>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-labelledby="size-label">
          {SIZES.map((n) => (
            <Chip key={n} on={size === n} role="radio" aria-checked={size === n} data-testid={`size-${n}`} onClick={() => setSize(n)} className="min-w-14 justify-center">
              {n} people
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-meta text-muted">Including you. You&apos;re only matched with people who picked the same size.</p>
      </section>

      <section className="mt-4" aria-labelledby="where-label">
        <h3 id="where-label" className="px-4 text-body font-semibold">Where you&apos;ll start from</h3>
        {loc.kind !== "manual" ? (
          <>
            <p className="px-4 text-meta text-muted">We use your location once to pick a nearby area. It isn&apos;t stored or shown to anyone.</p>
            <ListRow
              onClick={() => setLoc({ kind: "manual", reason: "Choose your area:" })}
              testId="choose-area"
              leading={<IconCircle><MapPin size={18} /></IconCircle>}
              title="Choose an area instead"
              trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
            />
          </>
        ) : (
          <div data-testid="area-picker">
            <p className="px-4 text-meta text-muted">{loc.reason}</p>
            <ul className="mt-1">
              {landmarks.map((l) => (
                <li key={l.id}>
                  <ListRow
                    onClick={() => join({ landmarkId: l.id, locationSource: "manual" })}
                    disabled={busy}
                    testId={`area-${l.id}`}
                    leading={<IconCircle><MapPin size={18} /></IconCircle>}
                    title={l.name}
                    subtitle={l.city}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="mx-4 mt-3 flex items-start gap-2 rounded-card bg-wash p-3 text-meta text-muted">
        <ShieldCheck size={16} className="mt-px shrink-0 text-ink" aria-hidden />
        <span>
          18+ only, matched within your age range{mode === "hangout" ? ", with other people planning a hangout" : ""}. Squads only meet at public places, never include anyone you&apos;ve blocked, and you can leave any time.
        </span>
      </p>

      {error && (
        <p role="alert" className="mx-4 mt-3 text-meta font-semibold text-badge" data-testid="queue-error">
          {error}
        </p>
      )}

      {loc.kind !== "manual" && (
        <div className={variant === "page" ? "sticky bottom-[calc(52px+env(safe-area-inset-bottom))] mt-4 border-t border-divider bg-surface px-4 py-3" : "px-4 pt-4 pb-1"}>
          <Button variant="primary" size="lg" block disabled={busy || loc.kind === "locating"} onClick={findSquad} data-testid="find-squad" icon={loc.kind === "locating" ? <Crosshair size={18} className="animate-spin" /> : null}>
            {loc.kind === "locating" ? "Finding your area…" : "Find my squad"}
          </Button>
        </div>
      )}
      {loc.kind === "manual" && <div className="h-4" />}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CalendarDays, ChevronRight, Crosshair, Lock, MapPin, MapPinned, ShieldCheck } from "lucide-react";
import { Button, Chip, IconCircle, ListRow } from "@/components/fb";
import { DateLine } from "@/components/events/DateLine";
import { QueueTogether, type TogetherRole } from "./QueueTogether";

type Mode = "events" | "hangout";

export interface SetupEvent { id: string; title: string; startsAt: string; venue: string; isPublic: boolean }

interface Props {
  mode?: Mode;
  event: SetupEvent | null;
  landmarks: { id: string; name: string; city: string }[];
  /** "page" = /queue/start; "sheet" = inside the event page's bottom sheet */
  variant?: "page" | "sheet";
  /** "Let friends see you're queuing": your saved setting (off until you turn it on) */
  shareDefault?: boolean;
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

export function QueueSetup({ event, landmarks, mode: initialMode = "events", variant = "page", shareDefault = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(event ? "events" : initialMode);
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [loc, setLoc] = useState<LocState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(shareDefault);
  const [together, setTogether] = useState<TogetherRole>({ role: "none", joined: 1 });
  const onRole = useCallback((r: TogetherRole) => {
    setTogether(r);
    // the squad needs room for the whole group plus at least one new person
    if (r.role === "host") setSize((n) => (n - 1 < r.joined ? (SIZES.find((x) => x - 1 >= r.joined) ?? n) : n));
  }, []);
  const member = together.role === "member";

  const join = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/queue/join", {
      method: "POST",
      body: JSON.stringify({ mode, eventId: mode === "events" ? event?.id ?? null : null, targetSize: size, visibleToFriends: share, ...body }),
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
            <Chip key={n} on={size === n} role="radio" aria-checked={size === n} data-testid={`size-${n}`} onClick={() => setSize(n)} disabled={together.role === "host" && n - 1 < together.joined} className="min-w-14 justify-center">
              {n} people
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-meta text-muted">Including you. You&apos;re only matched with people who picked the same size.</p>
      </section>

      <QueueTogether onRole={onRole} />

      {!member && <section className="mt-4" aria-labelledby="where-label">
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
      </section>}

      <label className="mx-4 mt-4 flex cursor-pointer items-start gap-3" data-testid="share-with-friends">
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">Let friends see you&apos;re queuing</span>
          <span className="block text-meta text-muted">
            Your friends see which event and area, never who else is in line. They can queue up too. You can change this on your profile.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
          data-testid="share-with-friends-toggle"
          className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-control transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-surface before:shadow before:transition-transform checked:bg-accent checked:before:translate-x-[18px]"
        />
      </label>

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

      {loc.kind !== "manual" && !member && (
        <div className={variant === "page" ? "sticky bottom-[calc(52px+env(safe-area-inset-bottom))] mt-4 border-t border-divider bg-surface px-4 py-3" : "px-4 pt-4 pb-1"}>
          <Button variant="primary" size="lg" block disabled={busy || loc.kind === "locating"} onClick={findSquad} data-testid="find-squad" icon={loc.kind === "locating" ? <Crosshair size={18} className="animate-spin" /> : null}>
            {loc.kind === "locating" ? "Finding your area…" : together.role === "host" && together.joined > 1 ? `Find a squad for ${together.joined} of you` : "Find my squad"}
          </Button>
        </div>
      )}
      {loc.kind === "manual" && <div className="h-4" />}
    </div>
  );
}

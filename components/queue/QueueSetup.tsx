"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronRight, Crosshair, Eye, Lock, MapPin, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Chip, IconCircle, ListRow } from "@/components/fb";
import { DateLine } from "@/components/events/DateLine";
import { Switch } from "@/components/album/Switch";
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
  sensitive_tonight: "Keep it to plans and vibe: your note can't mention health, religion, politics or sexuality.",
};

export function QueueSetup({ event, landmarks, mode: initialMode = "events", variant = "page", shareDefault = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(event ? "events" : initialMode);
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [loc, setLoc] = useState<LocState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(shareDefault);
  const [tonight, setTonight] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  // Opening the area list in place replaces the row you tapped: move focus to its heading so you don't lose your place.
  const areaHeading = useRef<HTMLHeadingElement>(null);
  const manual = loc.kind === "manual";
  useEffect(() => {
    if (manual) areaHeading.current?.focus();
  }, [manual]);
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
      body: JSON.stringify({ mode, eventId: mode === "events" ? event?.id ?? null : null, targetSize: size, visibleToFriends: share, tonight: tonight.trim() || null, ...body }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { error: "network" };
    if (j.ok) return router.push("/queue");
    setBusy(false);
    if (j.error === "too_far") setLoc({ kind: "manual", reason: "You're far from Queue Up areas. Pick one to find your squad" });
    else setError(ERRORS[j.error] ?? "Couldn't join the queue. Try again.");
  };

  const findSquad = async () => {
    // Joining triggers the browser's location prompt; any failure → manual pick.
    setLoc({ kind: "locating" });
    try {
      const pos = await getPosition();
      await join({ lat: pos.coords.latitude, lng: pos.coords.longitude, locationSource: "gps" });
    } catch {
      setLoc({ kind: "manual", reason: "Location is off. Pick an area to find your squad" });
    }
  };

  if (event && !event.isPublic)
    return (
      <p data-testid="queue-setup" className="flex items-center gap-2 bg-surface p-4 text-muted">
        <Lock size={16} aria-hidden /> Queue Up only works for events at public venues.
      </p>
    );

  const title = event ? event.title : mode === "hangout" ? "Plan a new hangout" : "Any event this weekend";
  const chevron = <ChevronRight size={20} className="text-muted" aria-hidden />;

  // One decision (size), one button. Everything optional is a quiet row that opens in place.
  return (
    <div data-testid="queue-setup" className="bg-surface">
      {variant === "page" ? (
        <div className="px-4 pt-3">
          {event && <DateLine start={new Date(event.startsAt)} />}
          <h2 className="text-headline font-bold" data-testid="queue-title">{title}</h2>
          {event && <p className="text-meta text-muted">{event.venue}</p>}
        </div>
      ) : (
        <h3 className="sr-only" data-testid="queue-title">{title}</h3>
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

      <section className={variant === "page" ? "mt-4 px-4" : "mt-3 px-4"} aria-labelledby="size-label">
        <h3 id="size-label" className="text-body font-semibold">Squad size, including you</h3>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-labelledby="size-label">
          {SIZES.map((n) => (
            <Chip key={n} on={size === n} role="radio" aria-checked={size === n} data-testid={`size-${n}`} onClick={() => setSize(n)} disabled={together.role === "host" && n - 1 < together.joined} className="min-w-14 justify-center">
              {n} people
            </Chip>
          ))}
        </div>
      </section>

      <div className="mt-3">
        <QueueTogether onRole={onRole} />

        {!member && (loc.kind !== "manual" ? (
          <ListRow
            onClick={() => setLoc({ kind: "manual", reason: "Pick an area to find your squad" })}
            testId="choose-area"
            leading={<IconCircle><MapPin size={18} /></IconCircle>}
            title="Starting area"
            subtitle="Location used once, never stored or shown"
            trailing={chevron}
          />
        ) : (
          <section data-testid="area-picker" aria-labelledby="area-label">
            <h3 id="area-label" ref={areaHeading} tabIndex={-1} className="px-4 pt-2 text-body font-semibold">{loc.reason}</h3>
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
          </section>
        ))}

        {noteOpen ? (
          <div className="px-4 py-2">
            <label htmlFor="tonight" className="block text-body font-semibold">What do you want tonight?</label>
            <textarea id="tonight" data-testid="tonight" value={tonight} onChange={(e) => setTonight(e.target.value.slice(0, 200))} rows={2} autoFocus
              placeholder="e.g. first night out since moving, somewhere I can actually talk"
              className="mt-1 w-full resize-none rounded-btn bg-wash p-3 text-body text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
            <p className="flex items-center gap-1 text-meta text-muted">
              <Lock size={12} aria-hidden /> Only your Companion reads this.{" "}
              <Link href="/profile" className="font-semibold text-link" data-testid="review-brief">What it shares</Link>
            </p>
          </div>
        ) : (
          <ListRow
            onClick={() => setNoteOpen(true)}
            testId="companion-note"
            leading={<IconCircle><Sparkles size={18} /></IconCircle>}
            title="Add a note for your Companion"
            subtitle="Your AI Companion talks to others for you"
            trailing={chevron}
          />
        )}

        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2" data-testid="share-with-friends">
          <IconCircle><Eye size={18} /></IconCircle>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-medium">Let friends see you&apos;re queuing</span>
            <span className="block text-meta text-muted">They see the event and your area</span>
          </span>
          <Switch checked={share} onChange={(e) => setShare(e.target.checked)} data-testid="share-with-friends-toggle" />
        </label>
      </div>

      <p className="mx-4 mt-2 flex items-center gap-1.5 text-meta text-muted" data-testid="safety-line">
        <ShieldCheck size={12} className="shrink-0" aria-hidden /> 18+, public places only, never anyone you&apos;ve blocked
      </p>

      {error && (
        <p role="alert" className="mx-4 mt-3 text-meta font-semibold text-badge" data-testid="queue-error">
          {error}
        </p>
      )}

      {loc.kind !== "manual" && !member && (
        <div className={variant === "page" ? "sticky bottom-[calc(52px+env(safe-area-inset-bottom))] mt-3 border-t border-divider bg-surface px-4 py-3" : "px-4 pt-3 pb-1"}>
          <Button variant="primary" size="lg" block disabled={busy || loc.kind === "locating"} onClick={findSquad} data-testid="find-squad" icon={loc.kind === "locating" ? <Crosshair size={18} className="animate-spin" /> : null}>
            {loc.kind === "locating" ? "Finding your area…" : together.role === "host" && together.joined > 1 ? `Find a squad for ${together.joined} of you` : "Find my squad"}
          </Button>
        </div>
      )}
      {loc.kind === "manual" && <div className="h-4" />}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronRight, Crosshair, Lock, MapPin, MapPinned, ShieldCheck, UserPlus } from "lucide-react";
import { Avatar, Button, Chip, IconCircle, ListRow, cn } from "@/components/fb";
import { DateLine } from "@/components/events/DateLine";

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
  friend_blocked: "One of the friends you picked can't be in a squad with everyone else.",
  too_many: "Leave at least one spot open for someone new.",
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
  const [friendIds, setFriendIds] = useState<string[]>([]);
  // At least one spot stays open for someone new, so a smaller size drops friends who no longer fit.
  const pickSize = (n: number) => {
    setSize(n);
    setFriendIds((ids) => ids.slice(0, n - 2));
  };

  const join = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const withFriends = friendIds.length > 0;
    const r = await fetch(withFriends ? "/api/groups" : "/api/queue/join", {
      method: "POST",
      body: JSON.stringify({ mode, eventId: mode === "events" ? event?.id ?? null : null, targetSize: size, visibleToFriends: share, ...body, ...(withFriends ? { friendIds } : {}) }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { error: "network" };
    if (j.ok) return router.push(withFriends ? `/queue/friends/${j.groupId}` : "/queue");
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
            <Chip key={n} on={size === n} role="radio" aria-checked={size === n} data-testid={`size-${n}`} onClick={() => pickSize(n)} className="min-w-14 justify-center">
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

      <FriendPicker size={size} picked={friendIds} onChange={setFriendIds} />

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

      {loc.kind !== "manual" && (
        <div className={variant === "page" ? "sticky bottom-[calc(52px+env(safe-area-inset-bottom))] mt-4 border-t border-divider bg-surface px-4 py-3" : "px-4 pt-4 pb-1"}>
          <Button variant="primary" size="lg" block disabled={busy || loc.kind === "locating"} onClick={findSquad} data-testid="find-squad" icon={loc.kind === "locating" ? <Crosshair size={18} className="animate-spin" /> : null}>
            {loc.kind === "locating" ? "Finding your area…" : friendIds.length ? "Invite friends" : "Find my squad"}
          </Button>
        </div>
      )}
      {loc.kind === "manual" && <div className="h-4" />}
    </div>
  );
}

interface QueueFriend { id: string; name: string; avatarColor: string; isSimulated: boolean; blocker: string | null }

const BLOCKER: Record<string, string> = {
  age_band: "Different age range, so you can't share a squad",
  women_only: "Doesn't fit a women-only squad",
  blocked: "Can't be in a squad with you",
  busy: "Already queuing",
  under_18: "Queue Up is 18+",
};

/**
 * Queue with friends: an "Add friends" row that opens your friends list. Picked friends get an
 * invite; at least one spot always stays open for someone new.
 */
function FriendPicker({ size, picked, onChange }: { size: number; picked: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<QueueFriend[] | null>(null);
  useEffect(() => {
    if (!open || friends) return;
    fetch("/api/groups/friends").then((r) => r.json()).then((j) => setFriends(j.friends ?? [])).catch(() => setFriends([]));
  }, [open, friends]);
  const max = size - 2;
  const names = (friends ?? []).filter((f) => picked.includes(f.id)).map((f) => f.name.split(" ")[0]);
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < max ? [...picked, id] : picked);
  return (
    <section className="mt-4" aria-labelledby="friends-label" data-testid="queue-with-friends">
      <h3 id="friends-label" className="px-4 text-body font-semibold">Queue with friends</h3>
      <ListRow
        onClick={() => setOpen((o) => !o)}
        testId="add-friends"
        leading={<IconCircle><UserPlus size={18} /></IconCircle>}
        title={picked.length ? `With ${names.join(", ") || `${picked.length} friends`}` : "Add friends"}
        subtitle={picked.length ? `${size - 1 - picked.length} ${size - 1 - picked.length === 1 ? "spot" : "spots"} left for new people` : "They'll get an invite. You stay together in one squad."}
        trailing={open ? <ChevronDown size={20} className="text-muted" aria-hidden /> : <ChevronRight size={20} className="text-muted" aria-hidden />}
      />
      {open && (
        <ul data-testid="friend-list" className="max-h-72 overflow-y-auto">
          {!friends && <li className="px-4 py-2 text-meta text-muted">Loading your friends…</li>}
          {friends?.length === 0 && <li className="px-4 py-2 text-meta text-muted">No friends to invite yet.</li>}
          {friends?.map((f) => {
            const on = picked.includes(f.id);
            const full = !on && picked.length >= max;
            return (
              <li key={f.id}>
                <ListRow
                  onClick={f.blocker ? undefined : () => toggle(f.id)}
                  disabled={Boolean(f.blocker) || full}
                  testId={`friend-${f.id}`}
                  data={{ picked: on, blocker: f.blocker ?? undefined }}
                  leading={<Avatar name={f.name} color={f.avatarColor} size={40} />}
                  title={f.name}
                  subtitle={f.blocker ? BLOCKER[f.blocker] : full ? "Squad is full: leave a spot for someone new" : f.isSimulated ? "Sample person" : undefined}
                  trailing={
                    !f.blocker && (
                      <span
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`Invite ${f.name}`}
                        className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", on ? "border-accent bg-accent text-surface" : "border-divider")}
                      >
                        {on && <Check size={14} strokeWidth={3} aria-hidden />}
                      </span>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

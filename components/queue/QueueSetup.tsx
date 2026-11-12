"use client";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Crosshair, Lock, MapPin, MessageSquareText, ShieldCheck, Sparkles, Swords, Users } from "lucide-react";

type Mode = "events" | "hangout";

interface Props {
  /** initial queue when not queuing from a specific event */
  mode?: Mode;
  event: { id: string; title: string; when: string; venue: string; isPublic: boolean } | null;
  landmarks: { id: string; name: string; city: string }[];
}

type LocState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "manual"; reason: string };

const SIZES = [2, 3, 4, 5, 6, 7, 8];

function getPosition(timeoutMs = 6000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 });
  });
}

export function QueueSetup({ event, landmarks, mode: initialMode = "events" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(event ? "events" : initialMode);
  const [size, setSize] = useState(6);
  const [loc, setLoc] = useState<LocState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tonight, setTonight] = useState("");

  const join = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/queue/join", {
      method: "POST",
      body: JSON.stringify({ mode, eventId: mode === "events" ? event?.id ?? null : null, targetSize: size, tonight: tonight.trim() || null, ...body }),
    });
    const j = await r.json();
    if (j.ok) return router.push("/queue");
    setBusy(false);
    if (j.error === "too_far") setLoc({ kind: "manual", reason: "You look far from our Queue Up areas. Pick where you'll meet:" });
    else if (j.error === "sensitive_tonight") setError("Keep it to plans and vibe: your note can't mention health, religion, politics or sexuality.");
    else setError(j.error === "private_event" ? "Queue Up is only for public venues." : "Couldn't join the queue. Try again.");
  };

  const findSquad = async () => {
    // Joining triggers the browser's location permission prompt; any failure → manual pick.
    setLoc({ kind: "locating" });
    try {
      const pos = await getPosition();
      await join({ lat: pos.coords.latitude, lng: pos.coords.longitude, locationSource: "gps" });
    } catch {
      setLoc({ kind: "manual", reason: "Location unavailable — choose your area instead:" });
    }
  };

  return (
    <div data-testid="queue-setup" className="min-h-[80dvh] bg-gradient-to-b from-[#0b1640] via-[#1b1464] to-[#2a0f5c] px-4 pb-8 pt-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a5b4fc]">Queue Up</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight" data-testid="queue-title">{event ? event.title : mode === "hangout" ? "Plan a new hangout" : "Any event this weekend"}</h1>
      <p className="text-sm text-[#c7d2fe]">
        {event
          ? `${event.when} · ${event.venue}`
          : mode === "hangout"
            ? "No event needed: we'll match your squad, then plan a hangout at a public spot near all of you, when you're all free."
            : "We'll match your squad, then sort you into an existing event you'll all like."}
      </p>

      {!event && (
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-white/10 p-1" role="radiogroup" aria-label="Queue type">
          {([
            ["events", "Existing events", CalendarDays],
            ["hangout", "New hangout", Sparkles],
          ] as const).map(([m, text, Icon]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} data-testid={`queue-mode-${m}`} onClick={() => setMode(m)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${mode === m ? "bg-white text-[#3b0f7a]" : "text-white/80"}`}>
              <Icon size={15} /> {text}
            </button>
          ))}
        </div>
      )}

      {event && !event.isPublic ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-white/10 p-3"><Lock size={16} /> Queue Up is only available for public venues.</p>
      ) : (
        <>
          <section className="mt-6">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Users size={16} /> Party size</p>
            <div className="mt-2 grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Party size">
              {SIZES.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={size === n} data-testid={`size-${n}`} onClick={() => setSize(n)}
                  className={`rounded-lg py-2.5 text-lg font-extrabold transition ${size === n ? "scale-105 bg-gradient-to-b from-[#60a5fa] to-[#7c3aed] shadow-[0_0_18px_rgba(124,58,237,.8)]" : "bg-white/10"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[#c7d2fe]">You&apos;ll only match with people who picked the same size.</p>
          </section>

          <section className="mt-6">
            <label htmlFor="tonight" className="flex items-center gap-1.5 text-sm font-semibold"><MessageSquareText size={16} /> What do you want tonight? <span className="font-normal text-[#c7d2fe]">(optional)</span></label>
            <textarea id="tonight" data-testid="tonight" value={tonight} onChange={(e) => setTonight(e.target.value.slice(0, 200))} rows={2}
              placeholder="e.g. first night out since moving, not drinking, somewhere I can actually talk"
              className="mt-2 w-full resize-none rounded-xl bg-white/10 p-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#a855f7]" />
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[#c7d2fe]"><Lock size={11} /> Only your Companion reads this. It uses it to judge who fits, and never repeats it.</p>
          </section>
          {loc.kind !== "manual" && (
            <button type="button" disabled={busy || loc.kind === "locating"} onClick={findSquad} data-testid="find-squad"
              className="queue-shimmer mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#22d3ee] via-[#6366f1] to-[#a855f7] py-4 text-xl font-extrabold shadow-[0_0_30px_rgba(99,102,241,.7)] disabled:opacity-70">
              {loc.kind === "locating" ? <><Crosshair className="animate-spin" size={22} /> Finding your area…</> : <><Swords size={22} /> Find my squad</>}
            </button>
          )}
          <p className="mt-4 text-center text-xs text-[#c7d2fe]" data-testid="companion-note">
            Your Companion AI will speak for you to find people you&apos;d click with.{" "}
            <Link href="/profile" className="underline" data-testid="review-brief">Review what it can share</Link>
          </p>
          {loc.kind !== "manual" && (
            <button type="button" className="mt-3 w-full text-center text-sm text-[#c7d2fe] underline" data-testid="choose-area"
              onClick={() => setLoc({ kind: "manual", reason: "Choose your area:" })}>
              Choose area instead
            </button>
          )}

          {loc.kind === "manual" && (
            <section className="mt-6" data-testid="area-picker">
              <p className="text-sm font-semibold">{loc.reason}</p>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {landmarks.map((l) => (
                  <li key={l.id}>
                    <button type="button" disabled={busy} data-testid={`area-${l.id}`} onClick={() => join({ landmarkId: l.id, locationSource: "manual" })}
                      className="flex w-full items-center gap-1.5 rounded-xl bg-white/10 p-3 text-left text-sm hover:bg-white/20">
                      <MapPin size={15} className="shrink-0 text-[#a5b4fc]" />
                      <span>
                        <span className="block font-semibold leading-tight">{l.name}</span>
                        <span className="text-xs text-[#c7d2fe]">{l.city}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {error && <p className="mt-4 rounded-lg bg-red-500/20 p-2 text-sm" data-testid="queue-error">{error}</p>}
          <p className="mt-6 flex items-start gap-1.5 text-xs text-[#c7d2fe]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Squads only include people in your age range{mode === "hangout" ? " who are also planning a hangout" : ""}, always meet at public venues, and never include anyone you&apos;ve blocked. Your location is only used to pick a nearby area.
          </p>
        </>
      )}
    </div>
  );
}

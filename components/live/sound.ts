"use client";

/** A short three-note chime made with Web Audio. No audio files.
 *  One shared context, unlocked on the first tap (phones need a gesture). */
let shared: AudioContext | null = null;

function ctxOrNull(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    shared ??= new Ctx();
    return shared;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  ctx.resume().catch(() => {});
  // A silent blip is what actually unlocks playback on iOS.
  try {
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    o.connect(gain).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {}
}

export async function playChime(): Promise<"played" | "blocked"> {
  const ctx = ctxOrNull();
  if (!ctx) return "blocked";
  try {
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const notes = [659.25, 830.61, 987.77];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(gain).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
    return ctx.state === "running" ? "played" : "blocked";
  } catch {
    return "blocked";
  }
}

/** A short buzz where the phone supports it (Android Chrome; not iOS Safari). */
export function vibrate(): "yes" | "unsupported" {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([90, 50, 140]);
      return "yes";
    }
  } catch {}
  return "unsupported";
}

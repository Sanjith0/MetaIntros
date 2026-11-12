"use client";

/** A short three-note chime made with Web Audio. No audio files. */
export async function playChime(): Promise<"played" | "blocked"> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
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
    setTimeout(() => ctx.close().catch(() => {}), 1200);
    return ctx.state === "running" ? "played" : "blocked";
  } catch {
    return "blocked";
  }
}

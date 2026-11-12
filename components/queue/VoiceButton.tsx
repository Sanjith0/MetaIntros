"use client";

import { useEffect, useRef, useState } from "react";

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function recognizer(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Say your sentence instead of typing it. Shown only when the flag is on and
 * the browser can do it; the text lands in the box, where you can edit it.
 * Typing always works.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const rec = useRef<Rec | null>(null);

  useEffect(() => setSupported(!!recognizer()), []);
  if (!supported) return null;

  const start = () => {
    const R = recognizer();
    if (!R) return;
    const r = new R();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((x) => x[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
      setState("idle");
    };
    r.onerror = () => setState("error");
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r;
    setState("listening");
    r.start();
  };

  return (
    <div className="mt-1" data-testid="voice">
      <button
        type="button"
        onClick={() => (state === "listening" ? rec.current?.stop() : start())}
        data-testid="voice-button"
        data-state={state}
        className={`press inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${state === "listening" ? "bg-[var(--color-badge)] text-white" : "bg-[var(--color-pq-soft)] text-[var(--color-pq)]"}`}
      >
        <span className={`h-2 w-2 rounded-full ${state === "listening" ? "animate-pulse bg-white" : "bg-[var(--color-pq)]"}`} />
        {state === "listening" ? "Listening… tap to stop" : "Say it instead"}
      </button>
      {state === "error" && <span className="ml-2 text-[12px] text-[var(--color-badge)]">Couldn't hear that. Type it instead.</span>}
      <div className="mt-0.5 text-[11px] text-[var(--color-ink-2)]">Uses your browser's speech recognition, which may send audio to your browser's provider. Typing always works.</div>
    </div>
  );
}

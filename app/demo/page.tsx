"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bot, Database, FastForward, Play, QrCode, RotateCcw, Smartphone, UserX, Users, Wifi, WifiOff } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useLiveEvents } from "@/components/useLiveEvents";

interface Status {
  fillMode: "simulated" | "mixed" | "live";
  simFillMs: number;
  aiMode: "mock" | "cache" | "live";
  hasModelKey: boolean;
  model: string;
  clockOffsetMs: number;
  liveUsers: number;
  buckets: Record<string, { size: number; users: { id: string; name: string; avatarColor: string; real: boolean; waitedMs: number; event: string | null }[] }[]>;
  parties: { id: string; status: string; event: string | null; area: string; size: number; real: number; cohesion: number | null }[];
  aiLog: { task: string; source: string; ms: number; error?: string }[];
  joinUrl: string;
  qr: string;
}

const SCRIPT = [
  "Events feed → open Indie Night",
  "Tap Queue Up, pick a party size",
  "Queue fills (~20s) — Players found k/N",
  "Party found → How we matched you streams in",
  "Your squad is going banner on the event",
  "Chats badge → squad chat + AI host welcome",
  "Open talk cards (swipe)",
  "Find your party → I'm here",
  "Fast-forward past the event → chat archives",
  "Add squad as friends → Met through Queue Up",
];

export default function DemoPage() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => fetch("/api/demo/status").then((r) => r.json()).then(setS).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);
  useLiveEvents(["demo"], load);

  const act = async (name: string, url: string, body?: unknown) => {
    setBusy(name);
    await fetch(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    await load();
    setBusy(null);
  };
  const setMode = (fillMode: Status["fillMode"]) => act("mode", "/api/demo/settings", { fillMode });

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#0b1640] px-4 pb-10 pt-5 text-white" data-testid="demo-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a5b4fc]">Queue Up</p>
      <h1 className="text-2xl font-extrabold">Demo control panel</h1>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" data-testid="demo-reset" disabled={!!busy} onClick={() => act("reset", "/api/demo/reset")}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 font-bold"><RotateCcw size={16} /> {busy === "reset" ? "Resetting…" : "Reset & reseed"}</button>
        <Link href="/events" data-testid="demo-start" className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1877f2] to-[#9333ea] py-3 font-bold"><Play size={16} /> Start as Me</Link>
        <button type="button" data-testid="demo-ff" onClick={() => act("ff", "/api/demo/fast-forward")}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-sm font-semibold"><FastForward size={16} /> Fast-forward time</button>
        <button type="button" data-testid="demo-kick" onClick={() => act("kick", "/api/demo/kick-live")}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-sm font-semibold"><UserX size={16} /> Kick live users ({s?.liveUsers ?? 0})</button>
      </section>

      <section className="mt-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Users size={16} /> Who fills the queue?</h2>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup">
          {(["simulated", "mixed", "live"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={s?.fillMode === m} data-testid={`mode-${m}`} onClick={() => setMode(m)}
              className={`rounded-lg py-2 text-sm font-bold capitalize ${s?.fillMode === m ? "bg-gradient-to-b from-[#60a5fa] to-[#7c3aed]" : "bg-white/10"}`}>
              {m === "live" ? "Live only" : m}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[#c7d2fe]">
          {s?.fillMode === "live" ? "Only real people (scan the QR). Everyone must pick the same party size." : s?.fillMode === "mixed" ? "Real people first; simulated users fill empty slots after ~12s." : "Simulated personas join over ~20s — works fully offline."}
        </p>
        <label className="mt-2 flex items-center justify-between text-xs text-[#c7d2fe]">
          Queue fill time
          <select value={s?.simFillMs ?? 18000} onChange={(e) => act("fill", "/api/demo/settings", { simFillMs: Number(e.target.value) })} className="rounded bg-white/10 px-2 py-1 text-white">
            {[6000, 12000, 18000, 25000].map((v) => <option key={v} value={v} className="text-black">{v / 1000}s</option>)}
          </select>
        </label>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-3 text-center text-fb-text" data-testid="demo-qr">
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold"><QrCode size={16} /> Judges: scan to join live</p>
        {s?.qr && <div className="mx-auto mt-2 w-[220px]" dangerouslySetInnerHTML={{ __html: s.qr }} />}
        <p className="mt-1 break-all font-mono text-xs text-fb-muted" data-testid="join-url">{s?.joinUrl}</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-fb-muted"><Smartphone size={12} /> Phones need HTTPS (tunnel) for GPS; otherwise they pick an area.</p>
      </section>

      <section className="mt-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Bot size={16} /> AI (Muse · {s?.model})</h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" data-testid="ai-cache" aria-pressed={s?.aiMode !== "live"} onClick={() => act("ai", "/api/demo/settings", { aiMode: "cache" })}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold ${s?.aiMode !== "live" ? "bg-emerald-600" : "bg-white/10"}`}><WifiOff size={14} /> Run from cache</button>
          <button type="button" data-testid="ai-live" disabled={!s?.hasModelKey} aria-pressed={s?.aiMode === "live"} onClick={() => act("ai", "/api/demo/settings", { aiMode: "live" })}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold disabled:opacity-40 ${s?.aiMode === "live" ? "bg-[#7c3aed]" : "bg-white/10"}`}><Wifi size={14} /> Live Muse</button>
        </div>
        <p className="mt-1 text-xs text-[#c7d2fe]">{s?.hasModelKey ? "Cache misses call Muse (budget-capped) and are saved for offline replays." : "No MODEL_API_KEY set: cached + deterministic fallbacks only."}</p>
        {s && s.aiLog.length > 0 && (
          <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-[#c7d2fe]" data-testid="ai-log">
            {s.aiLog.slice().reverse().map((l, i) => <li key={i}>{l.task} · {l.source} · {l.ms}ms{l.error ? ` · ${l.error}` : ""}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-5" data-testid="demo-queue">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Database size={16} /> Live queue</h2>
        {s && Object.keys(s.buckets).length === 0 && <p className="mt-1 text-xs text-[#c7d2fe]">Nobody waiting.</p>}
        {s && Object.entries(s.buckets).map(([bucket, groups]) => (
          <div key={bucket} className="mt-2 rounded-xl bg-white/5 p-2">
            <p className="text-xs font-semibold text-[#a5b4fc]">{bucket}</p>
            {groups.map((g) => (
              <div key={g.size} className="mt-1 flex items-center gap-2">
                <span className="w-14 text-xs">size {g.size}</span>
                <span className="flex flex-wrap gap-1">
                  {g.users.map((u) => (
                    <span key={u.id} title={`${u.name} · ${Math.round(u.waitedMs / 1000)}s`} className={u.real ? "rounded-full ring-2 ring-[#67e8f9]" : ""}>
                      <Avatar name={u.name} color={u.avatarColor} size={24} />
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
        {s && s.parties.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs" data-testid="demo-parties">
            {s.parties.map((p) => (
              <li key={p.id} className="rounded-lg bg-white/5 px-2 py-1">{p.status === "completed" ? "✓" : "●"} {p.size}-squad → {p.event} · {p.area} · {p.real} real · cohesion {Math.round((p.cohesion ?? 0) * 100)}%</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-bold">Script (5 min)</h2>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-[#c7d2fe]">{SCRIPT.map((x) => <li key={x}>{x}</li>)}</ol>
      </section>
    </main>
  );
}

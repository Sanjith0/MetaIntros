"use client";

import { AiStatusNote } from "@/components/ai/AiSource";
import { describeSource } from "@/lib/ai/status";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bot, Database, FastForward, Play, QrCode, RotateCcw, Smartphone, UserX, Users, Wifi, WifiOff } from "lucide-react";
import { Avatar } from "@/components/fb";
import { PrototypeLabel } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";

interface Status {
  fillMode: "simulated" | "mixed" | "live";
  simFillMs: number;
  aiMode: "mock" | "cache" | "live";
  hasModelKey: boolean;
  model: string;
  clockOffsetMs: number;
  liveUsers: number;
  buckets: Record<string, { size: number; queue: string; users: { id: string; name: string; avatarColor: string; real: boolean; waitedMs: number; event: string | null }[] }[]>;
  parties: { id: string; status: string; event: string | null; hangout?: boolean; area: string; size: number; real: number; accepted?: number; cohesion: number | null }[];
  aiLog: { task: string; source: string; ms: number; error?: string }[];
  joinUrl: string;
  qr: string;
}

const SCRIPT = [
  "Events feed → open Indie Night",
  "Find a squad to go with → size → Find my squad",
  "Queue fills (~20s): k of N found",
  "Your squad is ready → How we matched you",
  "Status card on the event and Events tab",
  "Open squad chat: AI host welcome",
  "Talk cards (quick reply or squad info)",
  "Find each other → I'm here",
  "Fast-forward: the event ends for everyone → chat archives",
  "Add squad as friends → Met through Link",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function fmtClock(ms: number) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function fmtOffset(ms: number) {
  const h = Math.round(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
}

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

  const [ffNote, setFfNote] = useState<string | null>(null);
  const act = async (name: string, url: string, body?: unknown) => {
    setBusy(name);
    const r = await fetch(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    if (name === "ff") {
      const j = r ? await r.json().catch(() => ({})) : {};
      setFfNote(j.ok ? `Ended ${j.eventTitle} for ${j.squads} squad${j.squads === 1 ? "" : "s"}. Chats are read-only; sharing and adding friends are open.` : "No active squad to end yet. Form a squad first.");
    }
    await load();
    setBusy(null);
  };
  const setMode = (fillMode: Status["fillMode"]) => act("mode", "/api/demo/settings", { fillMode });

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-wash px-4 pb-10 text-ink" data-testid="demo-panel">
      <PrototypeLabel className="-mx-4 mb-4" />
      <p className="text-meta text-muted">Link · presenter only</p>
      <h1 className="text-2xl font-extrabold">Demo control panel</h1>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" data-testid="demo-reset" disabled={!!busy} onClick={() => act("reset", "/api/demo/reset")}
          className="flex items-center justify-center gap-1.5 rounded-card bg-surface shadow-card py-3 font-bold"><RotateCcw size={16} /> {busy === "reset" ? "Resetting…" : "Reset & reseed"}</button>
        <Link href="/events" data-testid="demo-start" className="flex items-center justify-center gap-1.5 rounded-card bg-accent text-surface py-3 font-bold"><Play size={16} /> Start as Me</Link>
        <button type="button" data-testid="demo-ff" onClick={() => act("ff", "/api/demo/fast-forward")}
          className="flex items-center justify-center gap-1.5 rounded-card bg-surface shadow-card py-3 text-sm font-semibold"><FastForward size={16} /> {busy === "ff" ? "Ending event…" : "Fast-forward: end event"}</button>
        <button type="button" data-testid="demo-kick" onClick={() => act("kick", "/api/demo/kick-live")}
          className="flex items-center justify-center gap-1.5 rounded-card bg-surface shadow-card py-3 text-sm font-semibold"><UserX size={16} /> Kick live users ({s?.liveUsers ?? 0})</button>
      </section>

      {s && (
        <p className="mt-3 text-meta text-muted" data-testid="global-clock">
          Global clock: <b className="text-ink">{fmtClock(Date.now() + s.clockOffsetMs)}</b>
          {s.clockOffsetMs > 60_000 ? ` (fast-forwarded ${fmtOffset(s.clockOffsetMs)})` : " (real time)"} · same for every phone
        </p>
      )}
      {ffNote && (
        <p role="status" className="mt-2 rounded-card bg-surface p-3 text-meta" data-testid="ff-result">{ffNote}</p>
      )}

      <section className="mt-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Users size={16} /> Who fills the queue?</h2>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup">
          {(["simulated", "mixed", "live"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={s?.fillMode === m} data-testid={`mode-${m}`} onClick={() => setMode(m)}
              className={`rounded-btn py-2 text-sm font-bold capitalize ${s?.fillMode === m ? "bg-accent text-surface" : "bg-surface shadow-card"}`}>
              {m === "live" ? "Live only" : m}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {s?.fillMode === "live" ? "Only real people (scan the QR). Everyone must pick the same party size." : s?.fillMode === "mixed" ? "Real people first; simulated users fill empty slots after ~12s." : "Simulated personas join over ~20s — works fully offline."}
        </p>
        <label className="mt-2 flex items-center justify-between text-xs text-muted">
          Queue fill time
          <select value={s?.simFillMs ?? 18000} onChange={(e) => act("fill", "/api/demo/settings", { simFillMs: Number(e.target.value) })} className="rounded-btn bg-surface px-2 py-1 text-ink shadow-card">
            {[6000, 12000, 18000, 25000].map((v) => <option key={v} value={v} >{v / 1000}s</option>)}
          </select>
        </label>
      </section>

      <section className="mt-5 rounded-card bg-surface p-3 text-center text-ink" data-testid="demo-qr">
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold"><QrCode size={16} /> Judges: scan to join live</p>
        {s?.qr && <div className="mx-auto mt-2 w-[220px]" dangerouslySetInnerHTML={{ __html: s.qr }} />}
        <p className="mt-1 break-all text-xs text-muted" data-testid="join-url">{s?.joinUrl}</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted"><Smartphone size={12} /> Phones need HTTPS (tunnel) for GPS; otherwise they pick an area.</p>
      </section>

      <section className="mt-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Bot size={16} /> AI (Muse · {s?.model}) <span className="ml-auto font-normal"><AiStatusNote /></span></h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" data-testid="ai-cache" aria-pressed={s?.aiMode !== "live"} onClick={() => act("ai", "/api/demo/settings", { aiMode: "cache" })}
            className={`flex items-center justify-center gap-1 rounded-btn py-2 text-sm font-bold ${s?.aiMode !== "live" ? "bg-positive text-surface" : "bg-surface shadow-card"}`}><WifiOff size={14} /> Run from cache</button>
          <button type="button" data-testid="ai-live" disabled={!s?.hasModelKey} aria-pressed={s?.aiMode === "live"} onClick={() => act("ai", "/api/demo/settings", { aiMode: "live" })}
            className={`flex items-center justify-center gap-1 rounded-btn py-2 text-sm font-bold disabled:opacity-40 ${s?.aiMode === "live" ? "bg-accent text-surface" : "bg-surface shadow-card"}`}><Wifi size={14} /> Live Muse</button>
        </div>
        <p className="mt-1 text-xs text-muted">{s?.hasModelKey ? "Cache misses call Muse (budget-capped) and are saved for offline replays." : "No MODEL_API_KEY set: cached + deterministic fallbacks only."}</p>
        {s && s.aiLog.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[10px] text-muted" data-testid="ai-log">
            {s.aiLog.slice().reverse().map((l, i) => <li key={i}>{l.task} · {describeSource(l.source)?.label ?? l.source} · {l.ms}ms{l.error ? ` · ${l.error}` : ""}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-5" data-testid="demo-queue">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Database size={16} /> Live queue</h2>
        {s && Object.keys(s.buckets).length === 0 && <p className="mt-1 text-xs text-muted">Nobody waiting.</p>}
        {s && Object.entries(s.buckets).map(([bucket, groups]) => (
          <div key={bucket} className="mt-2 rounded-card bg-surface p-2">
            <p className="text-xs font-semibold text-muted">{bucket}</p>
            {groups.map((g) => (
              <div key={`${g.size}-${g.queue}`} className="mt-1 flex items-center gap-2" data-testid={`demo-queue-${g.queue.replace(" ", "-")}`}>
                <span className="w-24 text-xs">size {g.size} · {g.queue}</span>
                <span className="flex flex-wrap gap-1">
                  {g.users.map((u) => (
                    <span key={u.id} title={`${u.name} · ${Math.round(u.waitedMs / 1000)}s`} className={u.real ? "rounded-full ring-2 ring-accent" : ""}>
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
              <li key={p.id} className="rounded-btn bg-surface px-2 py-1">{p.status === "completed" ? "Done: " : p.status === "confirming" ? `Ready check (${p.accepted ?? 0}/${p.size} in): ` : "Active: "}{p.size}-squad → {p.hangout ? "new hangout: " : ""}{p.event} · {p.area} · {p.real} real · cohesion {Math.round((p.cohesion ?? 0) * 100)}%</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-bold">Script (5 min)</h2>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-muted">{SCRIPT.map((x) => <li key={x}>{x}</li>)}</ol>
      </section>
    </main>
  );
}

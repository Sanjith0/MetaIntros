"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { EVENTS, ME, profileById } from "@/data/seed";
import { loadFilters, post } from "@/lib/client";
import type { Crew, FormStep, Swap } from "@/lib/types";
import { Avatar, MuseMark } from "@/components/ui";

interface Status {
  bucket: { id: string; name: string; lat: number; lng: number };
  nearby: { id: string; name: string; hue: number; lat: number; lng: number }[];
  crewId: string | null;
}

type Phase = "searching" | "forming" | "found";

export default function QueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ev = EVENTS.find((e) => e.id === id)!;
  const [status, setStatus] = useState<Status | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("searching");
  const [steps, setSteps] = useState<Extract<FormStep, { type: "step" }>[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [swapping, setSwapping] = useState<Swap | null>(null);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const lastCount = useRef({ n: 0, at: Date.now() });
  const started = useRef(false);
  const filters = useRef(loadFilters(id));

  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  const startForming = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setPhase("forming");
    setNote(null);
    setSteps([]);
    setMembers([]);
    const res = await fetch("/api/crew/form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id, userId: ME, filters: filters.current }),
    });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const s = JSON.parse(line) as FormStep;
        if (s.type === "step") setSteps((x) => [...x, s]);
        else if (s.type === "draft") setMembers(s.memberIds);
        else if (s.type === "swap") {
          setSwapping(s.swap);
          setTimeout(() => {
            setMembers((m) => m.map((x) => (x === s.swap.out ? s.swap.in : x)));
            setSwapping(null);
          }, 700);
        } else if (s.type === "crew") {
          setCrew(s.crew);
          setMembers(s.crew.memberIds.filter((m) => m !== ME));
          setTimeout(() => setPhase("found"), 600);
        } else if (s.type === "error") {
          setNote(s.message);
          started.current = false;
          lastCount.current = { n: lastCount.current.n, at: Date.now() + 8000 }; // back off before retrying
          setPhase("searching");
        }
      }
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await fetch(`/api/queue/status?eventId=${id}&userId=${ME}`);
      const s = (await r.json()) as Status;
      if (!alive) return;
      setStatus(s);
      if (s.crewId && !started.current) startForming();
      const n = s.nearby.length;
      if (n !== lastCount.current.n) lastCount.current = { n, at: Date.now() };
      const need = filters.current.crewSize + 4;
      if (!started.current && n >= need && Date.now() - lastCount.current.at > 1500) startForming();
    };
    tick();
    const t = setInterval(tick, 400);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, startForming]);

  const fill = () => post("/api/demo/fill", { eventId: id });
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const me = profileById(ME)!;

  return (
    <div className="min-h-dvh bg-[#0b0f1a] text-white flex flex-col">
      <header className="h-14 px-3 flex items-center gap-2">
        <Link href={`/events/${id}`} className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10 text-xl" aria-label="Leave queue">
          ←
        </Link>
        <div className="text-sm text-white/70 truncate">{ev.title}</div>
      </header>

      {phase === "searching" && (
        <main className="flex-1 flex flex-col items-center px-4">
          <div className="text-xs tracking-[0.3em] text-white/50 mt-2">FINDING YOUR CREW</div>
          <div className="text-5xl font-bold tabular-nums mt-2" data-testid="queue-timer">{mm}:{ss}</div>
          <div className="text-sm text-white/60 mt-1">near {status?.bucket.name ?? "…"}</div>
          <Radar status={status} />
          <div className="text-lg font-semibold" data-testid="queue-count">
            {status ? status.nearby.length : "–"} in your area
          </div>
          <div className="text-sm text-white/50">Need {filters.current.crewSize} who click. Usually under 2 min.</div>
          {note && <div className="mt-3 text-sm text-amber-300">{note}</div>}
          <div className="flex-1" />
          <button onClick={fill} className="mb-6 mt-6 text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/60 hover:text-white" data-testid="demo-fill">
            ▶ Demo: fill queue
          </button>
        </main>
      )}

      {phase !== "searching" && (
        <main className="flex-1 px-4 pb-6">
          {phase === "found" ? (
            <div className="text-center mt-2">
              <div className="match-found text-3xl font-black text-[#7ef9c9]" data-testid="crew-found">CREW FOUND</div>
              <div className="text-white/70 mt-1">{crew?.vibe}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2 justify-center">
              <MuseMark size={18} />
              <span className="font-semibold">Muse is building your crew…</span>
            </div>
          )}

          <div className="flex justify-center gap-2 mt-5 flex-wrap">
            <div className="flex flex-col items-center gap-1 w-14">
              <Avatar p={me} size={52} ring="#7ef9c9" />
              <span className="text-[11px]">You</span>
            </div>
            {members.map((mid) => {
              const p = profileById(mid)!;
              const out = swapping?.out === mid;
              return (
                <div key={mid} className={`flex flex-col items-center gap-1 w-14 pop-in transition ${out ? "opacity-30 scale-75" : ""}`}>
                  <Avatar p={p} size={52} blurred ring={out ? "#ff5c7a" : "#ffffff33"} />
                  <span className={`text-[11px] ${out ? "line-through text-[#ff5c7a]" : ""}`}>{p.name}</span>
                </div>
              );
            })}
          </div>

          <ol className="mt-6 space-y-3" data-testid="agent-steps">
            {steps.map((s, i) => (
              <li key={s.id + i} className="fade-up flex gap-3">
                <div className={`mt-0.5 w-6 h-6 shrink-0 rounded-full grid place-items-center text-[12px] ${s.id.startsWith("swap") ? "bg-[#ff5c7a]" : s.ai ? "bg-muse" : "bg-white/15"}`}>
                  {s.id.startsWith("swap") ? "⇄" : s.ai ? "✦" : "✓"}
                </div>
                <div>
                  <div className="font-semibold text-[15px]">{s.label}</div>
                  {s.detail && <div className="text-[13px] text-white/60 leading-snug">{s.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
          {phase === "forming" && (
            <div className="mt-3 flex items-center gap-2 text-[13px] text-white/60" data-testid="thinking">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:300ms]" />
              </span>
              <ThinkingLine />
            </div>
          )}

          {phase === "found" && crew && (
            <Link href={`/crew/${crew.id}`} className="mt-6 h-12 rounded-xl bg-[#7ef9c9] text-[#0b0f1a] font-bold grid place-items-center pop-in" data-testid="view-crew">
              Meet your crew →
            </Link>
          )}
        </main>
      )}
    </div>
  );
}

function Radar({ status }: { status: Status | null }) {
  const size = 260;
  const c = status?.bucket;
  return (
    <div className="relative my-6" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border border-white/10" />
      <div className="absolute inset-[22%] rounded-full border border-white/10" />
      <div className="absolute inset-[44%] rounded-full bg-[#7ef9c9]/80 radar" />
      <div className="absolute inset-[44%] rounded-full bg-[#7ef9c9]/80 radar" style={{ animationDelay: "1.2s" }} />
      {c &&
        status!.nearby.map((p) => {
          const isMe = p.id === ME;
          const dx = isMe ? 0 : (p.lng - c.lng) / 0.0032;
          const dy = isMe ? 0 : (p.lat - c.lat) / 0.0032;
          const x = size / 2 + Math.max(-1, Math.min(1, dx)) * (size / 2 - 22);
          const y = size / 2 - Math.max(-1, Math.min(1, dy)) * (size / 2 - 22);
          return (
            <div key={p.id} className="absolute pop-in" style={{ left: x - 16, top: y - 16 }}>
              <Avatar p={p} size={32} blurred={!isMe} ring={isMe ? "#7ef9c9" : "#ffffff22"} />
            </div>
          );
        })}
    </div>
  );
}

const WEIGHING = ["Comparing everyone's free time", "Checking energy levels: chill vs. loud", "Looking for taste clashes", "Weighing budgets", "Finding shared groups and events", "Checking walking distance to the show"];

function ThinkingLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WEIGHING.length), 1600);
    return () => clearInterval(t);
  }, []);
  return <span key={i} className="fade-up">{WEIGHING[i]}…</span>;
}

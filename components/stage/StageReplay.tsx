"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trace } from "@/contracts";
import { Avatar } from "@/components/Avatar";
import { boardAt, replayDelay } from "@/lib/stage/board";
import type { StageView } from "@/lib/server/views";

const CONVO: Record<Trace["conversation"], [string, string]> = {
  table: ["Table", "bg-sky-400/15 text-sky-300"],
  pair: ["Pairs", "bg-amber-400/15 text-amber-300"],
  judge: ["Code", "bg-emerald-400/15 text-emerald-300"],
  formation: ["Queue", "bg-violet-400/15 text-violet-300"],
};

const TONE: Record<string, string> = {
  reject: "ring-red-500/60 bg-red-500/[0.08]",
  block: "ring-red-500/70 bg-red-500/[0.12]",
  sign: "ring-emerald-400/40 bg-emerald-400/[0.06]",
  lock: "ring-emerald-400/70 bg-emerald-400/[0.12]",
  hold: "ring-amber-400/50 bg-amber-400/[0.06]",
};

const SPEEDS = [1, 2, 4] as const;

/** Colour each body line: rejections red, accepts green. */
function Body({ text }: { text: string }) {
  return (
    <div className="mt-1 space-y-0.5 text-[16px] leading-snug text-white/80">
      {text.split("\n").map((line, i) => {
        const red = line.startsWith("✗") || /^Code overrode|Blocked /.test(line);
        const green = line.startsWith("✓");
        return (
          <div key={i} className={red ? "font-medium text-red-300" : green ? "text-emerald-200/90" : ""}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The projector, with a scrubber. Every position on the scrubber rebuilds
 * the board (plans, signatures, the lock) from the trace up to that point.
 */
export function StageReplay({ initial }: { initial: StageView }) {
  const [view, setView] = useState(initial);
  const [pos, setPos] = useState(initial.traces.length ? 0 : 0);
  const [playing, setPlaying] = useState(initial.traces.length > 0);
  const [live, setLive] = useState(initial.traces.length === 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const partyRef = useRef(initial.partyId);
  const privRef = useRef<HTMLUListElement>(null);
  const sharedRef = useRef<HTMLUListElement>(null);
  const total = view.traces.length;

  // Replay at the recorded pace (scaled).
  useEffect(() => {
    if (!playing || live) return;
    if (pos >= total) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPos((p) => Math.min(total, p + 1)), pos === 0 ? 300 : replayDelay(view.traces, pos - 1, speed));
    return () => clearTimeout(t);
  }, [playing, live, pos, total, speed, view.traces]);

  // Live: follow new traces as they arrive.
  useEffect(() => {
    const es = new EventSource("/api/stream?stage=1");
    es.addEventListener("trace", async (msg) => {
      const t = JSON.parse((msg as MessageEvent).data) as Trace;
      if (t.partyId !== partyRef.current) {
        partyRef.current = t.partyId;
        const fresh = (await (await fetch(`/api/stage?party=${t.partyId}`)).json()) as StageView;
        fresh.plans ??= [];
        setView(fresh);
        setLive(true);
        setPlaying(false);
        setPos(fresh.traces.length);
        return;
      }
      setView((v) => (v.traces.some((x) => x.id === t.id) ? v : { ...v, traces: [...v.traces, t] }));
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    if (live) setPos(total);
  }, [live, total]);

  const visible = view.traces.slice(0, pos);
  const board = useMemo(() => boardAt(view.traces, pos), [view.traces, pos]);
  const priv = visible.filter((t) => t.lane === "private");
  const shared = visible.filter((t) => t.lane === "shared");
  const members = useMemo(() => Object.fromEntries(view.members.map((m) => [m.id, m])), [view.members]);
  const t0 = view.traces[0] ? Date.parse(view.traces[0].at) : 0;
  const tAt = (i: number) => (view.traces[i - 1] ? (Date.parse(view.traces[i - 1]!.at) - t0) / 1000 : 0);

  useEffect(() => {
    privRef.current?.scrollTo({ top: privRef.current.scrollHeight, behavior: "smooth" });
    sharedRef.current?.scrollTo({ top: sharedRef.current.scrollHeight, behavior: "smooth" });
  }, [priv.length, shared.length]);

  const startDemo = useCallback(async () => {
    setLive(true);
    await fetch("/api/demo/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "all" }) });
  }, []);

  const status = board.locked ? "Locked" : board.round >= 1 ? `Round ${board.round}` : total ? "Forming" : "Waiting";
  const planTitle = (id: string | null) => view.plans.find((p) => p.id === id)?.title ?? "";

  const Row = ({ t }: { t: Trace }) => {
    const m = t.actorId ? members[t.actorId] : undefined;
    const [label, tone] = CONVO[t.conversation];
    return (
      <li data-testid={`trace-${t.lane}`} data-tone={t.tone ?? "neutral"} className={`flex gap-3 rounded-[10px] p-3 ring-1 ${t.tone && TONE[t.tone] ? TONE[t.tone] : "bg-white/[0.04] ring-white/[0.06]"}`}>
        {m ? <Avatar name={m.name} hue={m.hue} size={36} /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white/70">PQ</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{label}</span>
            {(t.tone === "reject" || t.tone === "block") && <span className="rounded bg-red-500/80 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">{t.tone === "block" ? "Blocked" : "Rejected"}</span>}
            <span className="text-[15px] font-semibold text-white">{t.title}</span>
          </div>
          <Body text={t.body} />
        </div>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-[#0c0d12] text-white" data-testid="stage">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-violet-300">Party Queue · Stage</div>
          <div className="text-[22px] font-bold">Five agents settle one night out</div>
        </div>
        <span data-testid="stage-status" className={`rounded-full px-3 py-1 text-[13px] font-semibold ${board.locked ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/80"}`}>
          {status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={startDemo} data-testid="stage-start" className="rounded-[6px] bg-violet-500 px-3 py-1.5 text-[13px] font-semibold hover:bg-violet-400">
            Start demo party
          </button>
          <span className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">Hackathon prototype, not Facebook</span>
        </div>
      </header>

      {/* Scrubber */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-2.5" data-testid="scrubber-bar">
        <button
          data-testid="play"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => {
            setLive(false);
            if (pos >= total) setPos(0);
            setPlaying((p) => !p);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[15px] hover:bg-white/20"
        >
          {playing && !live ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          aria-label="Replay position"
          data-testid="scrubber"
          min={0}
          max={total}
          value={pos}
          onChange={(e) => {
            setLive(false);
            setPlaying(false);
            setPos(Number(e.target.value));
          }}
          className="h-2 flex-1 cursor-pointer accent-violet-400"
        />
        <span className="w-[120px] text-right font-mono text-[13px] tabular-nums text-white/70" data-testid="scrub-time">
          {tAt(pos).toFixed(1)}s / {tAt(total).toFixed(1)}s
        </span>
        <div className="flex overflow-hidden rounded-[6px] ring-1 ring-white/15">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-1 text-[12px] font-semibold ${speed === s ? "bg-white/20" : "hover:bg-white/10"}`}>
              {s}×
            </button>
          ))}
        </div>
        <button
          data-testid="go-live"
          onClick={() => {
            setPlaying(false);
            setLive(true);
          }}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${live ? "bg-red-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
        >
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-white" : "bg-white/50"}`} /> Live
        </button>
      </div>

      {/* Board: plans and signatures at this point in time */}
      {view.plans.length > 0 && (
        <div className="grid grid-cols-1 gap-3 border-b border-white/10 px-6 py-3 xl:grid-cols-[1fr_auto]">
          <ul className="flex flex-wrap items-center gap-2" data-testid="stage-plans">
            {view.plans.map((p) => {
              const out = board.unavailable.includes(p.id);
              const lock = board.locked === p.id;
              const lead = board.leading === p.id && !lock;
              return (
                <li
                  key={p.id}
                  data-state={lock ? "locked" : out ? "unavailable" : lead ? "leading" : "open"}
                  className={`rounded-full px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                    lock ? "match-pop bg-emerald-500 text-white" : out ? "bg-red-500/15 text-red-300 line-through decoration-red-400" : lead ? "bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/60" : "bg-white/10 text-white/80"
                  }`}
                >
                  {lock ? "🔒 " : ""}
                  {p.title}
                  {out ? " · unavailable" : lead ? " · leading" : ""}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3" data-testid="signatures">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-white/50">{board.leading ? `Signatures on ${planTitle(board.locked ?? board.leading)}` : "Signatures"}</span>
            {view.members.map((m) => {
              const sig = board.signatures[m.id];
              const ok = sig === "signed" || sig === "conceded";
              return (
                <span key={m.id} className="relative flex flex-col items-center" data-testid={`sig-${m.id}`} data-sig={sig ?? "none"} title={`${m.firstName}: ${sig ?? "waiting"}`}>
                  <span className={`rounded-full ring-2 ${ok ? "ring-emerald-400" : sig === "holding" ? "ring-amber-400" : "ring-transparent"}`}>
                    <Avatar name={m.name} hue={m.hue} size={34} />
                  </span>
                  {ok && <span className="match-pop absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-black">✓</span>}
                  {sig === "holding" && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black">…</span>}
                  <span className="mt-0.5 text-[10px] text-white/60">{m.firstName}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[20px] text-white/50">Waiting for a party to form…</div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col rounded-[14px] bg-white/[0.03] ring-1 ring-white/10">
            <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-[18px] font-bold">Private</div>
                <div className="text-[13px] text-white/50">Each agent's own reasoning, code checks and verifier blocks. No member ever sees another's.</div>
              </div>
              <div className="shrink-0 whitespace-nowrap pl-3 text-[12px] text-red-300">{board.rejections + board.blocks > 0 ? `${board.rejections} rejecting · ${board.blocks} blocked` : ""}</div>
            </div>
            <ul ref={privRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3" data-testid="stage-private">
              {priv.map((t) => (
                <Row key={t.id} t={t} />
              ))}
            </ul>
          </section>
          <section className="flex min-h-0 flex-col rounded-[14px] bg-white/[0.03] ring-1 ring-white/10">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-[18px] font-bold">Shared</div>
              <div className="text-[13px] text-white/50">What the table and each pair actually see. Rejected plans show only as "unavailable".</div>
            </div>
            <ul ref={sharedRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3" data-testid="stage-shared">
              {shared.map((t) => (
                <Row key={t.id} t={t} />
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

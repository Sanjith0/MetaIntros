"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trace } from "@/contracts";
import { Avatar } from "@/components/Avatar";
import { LeakTest } from "@/components/stage/LeakTest";
import { WhatIf } from "@/components/stage/WhatIf";
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

interface PromptView {
  title: string;
  system: string;
  user: string;
  audit: { chars: number; own: number; others: { ownerId: string; text: string }[] };
}

/** The context audit for one agent turn: what code found in the prompt before it went to the model. */
function ContextChip({ t, onOpen }: { t: Trace; onOpen: () => void }) {
  const c = t.meta?.context;
  if (!c) return null;
  const clean = c.others === 0;
  return (
    <button
      onClick={onOpen}
      data-testid="context-chip"
      data-others={c.others}
      data-actor={t.actorId}
      data-round={t.meta?.round}
      title="Open the exact prompt this agent got"
      className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide underline-offset-2 hover:underline ${clean ? "bg-emerald-400/15 text-emerald-200" : "bg-red-500 text-white"}`}
    >
      {clean ? `own brief only ✓ · ${(c.chars / 1000).toFixed(1)}k chars` : `held ${c.others} of someone else's words`}
    </button>
  );
}

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

/** Where an agent's answer came from, and how long it took. */
function SourceChip({ meta }: { meta: Trace["meta"] }) {
  if (!meta?.source) return null;
  const ms = typeof meta.ms === "number" ? fmtMs(meta.ms) : "";
  const look: Record<string, string> = {
    model: "bg-emerald-400/20 text-emerald-200",
    mock: "bg-white/10 text-white/60",
    fallback: "bg-amber-400 text-black",
    recorded: "bg-sky-400/25 text-sky-200",
  };
  const label = meta.source === "fallback" ? `Fallback · ${meta.note ?? "model unavailable"}` : meta.source === "recorded" ? `Recorded · ${ms}` : `${meta.source} · ${ms}`;
  return (
    <span data-testid="source-chip" data-source={meta.source} className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${look[meta.source] ?? ""}`} title={meta.note}>
      {label}
    </span>
  );
}

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
export function StageReplay({ initial, leakTest = false, whatIf = false, pinned: pinnedAtLoad = null }: { initial: StageView; leakTest?: boolean; whatIf?: boolean; pinned?: string | null }) {
  const [prompt, setPrompt] = useState<PromptView | null>(null);
  const openPrompt = async (t: Trace) => {
    if (!t.actorId || !t.meta?.round) return;
    const r = await fetch(`/api/stage/prompt?party=${t.partyId}&owner=${t.actorId}&round=${t.meta.round}`, { cache: "no-store" });
    if (r.ok) setPrompt({ title: t.title, ...((await r.json()) as Omit<PromptView, "title">) });
  };
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!prompt) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPrompt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt]);
  const [view, setView] = useState(initial);
  const [pos, setPos] = useState(initial.traces.length ? 0 : 0);
  const [playing, setPlaying] = useState(initial.traces.length > 0);
  const [live, setLive] = useState(initial.traces.length === 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const partyRef = useRef(initial.partyId);
  // F28: null follows new parties; an id keeps the projector on that party.
  const [pinned, setPinned] = useState<string | null>(pinnedAtLoad);
  const pinnedRef = useRef<string | null>(pinnedAtLoad);
  const [parties, setParties] = useState(initial.parties ?? []);
  const loadParty = async (id: string | null) => {
    const fresh = (await (await fetch(id ? `/api/stage?party=${id}` : "/api/stage", { cache: "no-store" })).json()) as StageView;
    fresh.plans ??= [];
    partyRef.current = fresh.partyId;
    setView(fresh);
    if (fresh.parties) setParties(fresh.parties);
    const done = fresh.traces.some((t) => t.meta?.kind === "locked" || t.meta?.kind === "nomatch");
    setLive(!done);
    setPlaying(false);
    setPos(fresh.traces.length);
  };
  const choose = (id: string) => {
    const next = id || null;
    pinnedRef.current = next;
    setPinned(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("party", next);
    else url.searchParams.delete("party");
    window.history.replaceState(null, "", url);
    void loadParty(next);
  };
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
      // Pinned to another party: keep the list fresh, but stay put.
      if (pinnedRef.current && t.partyId !== pinnedRef.current) {
        if (t.meta?.kind === "formed" || t.meta?.kind === "locked" || t.meta?.kind === "nomatch") {
          void fetch("/api/stage?party=" + pinnedRef.current, { cache: "no-store" })
            .then((r) => r.json())
            .then((v: StageView) => v.parties && setParties(v.parties));
        }
        return;
      }
      // A new party (or the same id after a demo reset) starts a fresh board.
      if (t.partyId !== partyRef.current || t.meta?.kind === "formed") {
        partyRef.current = t.partyId;
        const fresh = (await (await fetch(`/api/stage?party=${t.partyId}`)).json()) as StageView;
        fresh.plans ??= [];
        setView(fresh);
        if (fresh.parties) setParties(fresh.parties);
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

  // Per-agent latency, from the agents' own turns so far.
  const latency = useMemo(() => {
    const m: Record<string, { round: number; ms: number; source: string; note?: string }[]> = {};
    for (const t of visible) {
      if (t.meta?.kind !== "verdicts" || !t.actorId || typeof t.meta.ms !== "number") continue;
      (m[t.actorId] ??= []).push({ round: t.meta.round ?? 0, ms: t.meta.ms, source: t.meta.source ?? "mock", note: t.meta.note });
    }
    return m;
  }, [visible]);
  const recorded = view.traces.find((t) => t.meta?.source === "recorded" && t.meta.note) ?? view.traces.find((t) => t.meta?.source === "recorded");

  const noMatch = visible.some((t) => t.meta?.kind === "nomatch");
  const rogue = view.traces.some((t) => t.meta?.kind === "rogue");
  const status = board.locked ? "Locked" : noMatch ? "No match" : board.round >= 1 ? `Round ${board.round}` : total ? "Forming" : "Waiting";
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
            <SourceChip meta={t.meta} />
            <ContextChip t={t} onOpen={() => openPrompt(t)} />
          </div>
          <Body text={t.body} />
        </div>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-[#0c0d12] text-white lg:overflow-hidden" data-testid="stage">
      {prompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Agent prompt" onClick={(e) => e.target === e.currentTarget && setPrompt(null)}>
          <div className="flex max-h-[88vh] w-full max-w-[860px] flex-col rounded-[14px] bg-[#14151c] ring-1 ring-white/15" data-testid="prompt-view">
            <div className="flex items-start gap-3 border-b border-white/10 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-violet-300">The exact prompt</div>
                <div className="text-[18px] font-bold">{prompt.title}</div>
                <div className="mt-1 text-[13px] text-white/70" data-testid="prompt-audit">
                  {prompt.audit.others.length === 0
                    ? `Checked by code before the call: ${prompt.audit.own} of its own rules, and none of the other four members' private words.`
                    : `Checked by code: held someone else's private words (${prompt.audit.others.length}).`}
                </div>
              </div>
              <button ref={closeRef} onClick={() => setPrompt(null)} className="rounded-[6px] bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/20">
                Close
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-white/80" tabIndex={0} data-testid="prompt-text">
              {prompt.system}
              {"\n\n"}
              {(() => {
                const [json, ask] = prompt.user.split("\n\n");
                try {
                  return JSON.stringify(JSON.parse(json ?? ""), null, 2) + "\n\n" + (ask ?? "");
                } catch {
                  return prompt.user;
                }
              })()}
            </pre>
          </div>
        </div>
      )}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-violet-300">Party Queue · Stage</div>
          <div className="text-[19px] font-bold sm:text-[22px]">Five agents settle one night out</div>
        </div>
        {recorded && (
          <span data-testid="recorded-banner" className="rounded-full bg-sky-400/20 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-sky-200" title={recorded.meta?.note}>
            Recorded replay · {recorded.meta?.note ?? "from a saved run"}
          </span>
        )}
        {rogue && (
          <span data-testid="rogue-banner" className="rounded-full bg-red-600 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-white" title="Every agent accepts everything and tries to leak; code still decides">
            Rogue model · code still decides
          </span>
        )}
        <span data-testid="stage-status" className={`rounded-full px-3 py-1 text-[13px] font-semibold ${board.locked ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/80"}`}>
          {status}
        </span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <button onClick={startDemo} data-testid="stage-start" className="rounded-[6px] bg-violet-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-violet-500">
            Start demo party
          </button>
          {parties.length > 1 && (
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-white/70">
              <span className="sr-only sm:not-sr-only">Party</span>
              <select
                value={pinned ?? ""}
                onChange={(e) => choose(e.target.value)}
                data-testid="stage-party"
                aria-label="Which party the projector shows"
                className="h-[30px] max-w-[240px] rounded-[6px] bg-white/10 px-2 text-[13px] font-semibold text-white ring-1 ring-white/20"
              >
                <option value="" className="bg-[#14151c]">
                  Follow new parties
                </option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#14151c]">
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {leakTest && <LeakTest partyId={view.partyId} members={view.members} />}
          {whatIf && <WhatIf partyId={view.partyId} locked={view.traces.some((t) => t.meta?.kind === "locked")} />}
          <span className="whitespace-nowrap rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60 sm:text-[11px]">Hackathon prototype, not Facebook</span>
        </div>
      </header>

      {/* Scrubber */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:flex-nowrap sm:px-6" data-testid="scrubber-bar">
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
          className="h-2 min-w-[120px] flex-1 cursor-pointer accent-violet-400"
        />
        <span className="whitespace-nowrap text-right font-mono text-[13px] tabular-nums text-white/70 sm:w-[120px]" data-testid="scrub-time">
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
        <div className="grid grid-cols-1 gap-3 border-b border-white/10 px-4 py-3 sm:px-6 xl:grid-cols-[1fr_auto]">
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
          <div className="flex flex-wrap items-center gap-3" data-testid="signatures">
            <span className="w-full text-[12px] font-semibold uppercase tracking-wide text-white/50 sm:w-auto">{board.leading ? `Signatures on ${planTitle(board.locked ?? board.leading)}` : "Signatures"}</span>
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

      {Object.keys(latency).length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2 sm:px-6" data-testid="latency-strip">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white/50">Agent latency</span>
          {view.members.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 text-[12px]" data-testid={`latency-${m.id}`}>
              <span className="font-semibold text-white/80">{m.firstName}</span>
              {(latency[m.id] ?? []).map((c) => (
                <span
                  key={c.round}
                  title={c.note}
                  className={`rounded px-1 font-mono tabular-nums ${c.source === "fallback" ? "bg-amber-400 font-bold text-black" : c.source === "recorded" ? "bg-sky-400/20 text-sky-200" : c.source === "model" ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/60"}`}
                >
                  r{c.round} {c.source === "fallback" ? "timeout" : fmtMs(c.ms)}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[20px] text-white/50">Waiting for a party to form…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
          <section className="flex flex-col rounded-[14px] bg-white/[0.03] ring-1 ring-white/10 lg:min-h-0">
            <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-[18px] font-bold">Private</div>
                <div className="text-[13px] text-white/50">Each agent's own reasoning, code checks and verifier blocks. No member ever sees another's.</div>
              </div>
              <div className="shrink-0 whitespace-nowrap pl-3 text-[12px] text-red-300">{board.rejections + board.blocks > 0 ? `${board.rejections} rejecting · ${board.blocks} blocked` : ""}</div>
            </div>
            <ul ref={privRef} tabIndex={0}
              aria-label="Private column"
              className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-3 lg:max-h-none lg:min-h-0 lg:flex-1" data-testid="stage-private">
              {priv.map((t) => (
                <Row key={t.id} t={t} />
              ))}
            </ul>
          </section>
          <section className="flex flex-col rounded-[14px] bg-white/[0.03] ring-1 ring-white/10 lg:min-h-0">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-[18px] font-bold">Shared</div>
              <div className="text-[13px] text-white/50">What the table and each pair actually see. Rejected plans show only as "unavailable".</div>
            </div>
            <ul ref={sharedRef} tabIndex={0}
              aria-label="Shared column"
              className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-3 lg:max-h-none lg:min-h-0 lg:flex-1" data-testid="stage-shared">
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

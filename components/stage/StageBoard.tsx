"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trace } from "@/contracts";
import { Avatar } from "@/components/Avatar";
import type { StageView } from "@/lib/server/views";

const CONVO_LABEL: Record<Trace["conversation"], string> = { table: "Table", pair: "Pairs", judge: "Code", formation: "Queue" };
const CONVO_TONE: Record<Trace["conversation"], string> = {
  table: "bg-sky-400/15 text-sky-300",
  pair: "bg-amber-400/15 text-amber-300",
  judge: "bg-emerald-400/15 text-emerald-300",
  formation: "bg-violet-400/15 text-violet-300",
};

function statusOf(traces: Trace[]) {
  if (traces.some((t) => t.title === "Plan locked")) return "Locked";
  if (traces.some((t) => t.conversation === "table")) return "Talking";
  if (traces.length) return "Forming";
  return "Waiting";
}

/** Projector view: private reasoning on the left, what the party sees on
 *  the right, replayed in order and then streamed live. */
export function StageBoard({ initial }: { initial: StageView }) {
  const [view, setView] = useState(initial);
  const [shown, setShown] = useState(0);
  const [replaying, setReplaying] = useState(initial.traces.length > 0);
  const privRef = useRef<HTMLUListElement>(null);
  const sharedRef = useRef<HTMLUListElement>(null);
  const partyRef = useRef(initial.partyId);

  // Replay what already happened, one line at a time.
  useEffect(() => {
    if (!replaying) return;
    if (shown >= view.traces.length) {
      setReplaying(false);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 280);
    return () => clearTimeout(t);
  }, [replaying, shown, view.traces.length]);

  // Then stay live.
  useEffect(() => {
    const es = new EventSource("/api/stream?stage=1");
    es.addEventListener("trace", async (msg) => {
      const t = JSON.parse((msg as MessageEvent).data) as Trace;
      if (t.partyId !== partyRef.current) {
        partyRef.current = t.partyId;
        const fresh = (await (await fetch(`/api/stage?party=${t.partyId}`)).json()) as StageView;
        setView(fresh);
        setShown(fresh.traces.length);
        setReplaying(false);
        return;
      }
      setView((v) => (v.traces.some((x) => x.id === t.id) ? v : { ...v, traces: [...v.traces, t] }));
      setShown((n) => n + 1);
    });
    return () => es.close();
  }, []);

  const visible = view.traces.slice(0, replaying ? shown : view.traces.length);
  const priv = visible.filter((t) => t.lane === "private");
  const shared = visible.filter((t) => t.lane === "shared");
  const members = useMemo(() => Object.fromEntries(view.members.map((m) => [m.id, m])), [view.members]);

  useEffect(() => {
    privRef.current?.scrollTo({ top: privRef.current.scrollHeight, behavior: "smooth" });
    sharedRef.current?.scrollTo({ top: sharedRef.current.scrollHeight, behavior: "smooth" });
  }, [priv.length, shared.length]);

  const startDemo = useCallback(async () => {
    await fetch("/api/demo/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "all" }) });
  }, []);

  const status = statusOf(visible);

  const Row = ({ t }: { t: Trace }) => {
    const m = t.actorId ? members[t.actorId] : undefined;
    return (
      <li className="flex gap-3 rounded-[10px] bg-white/[0.04] p-3 ring-1 ring-white/[0.06]" data-testid={`trace-${t.lane}`}>
        {m ? <Avatar name={m.name} hue={m.hue} size={36} /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white/70">PQ</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CONVO_TONE[t.conversation]}`}>{CONVO_LABEL[t.conversation]}</span>
            <span className="text-[15px] font-semibold text-white">{t.title}</span>
          </div>
          <div className="mt-1 whitespace-pre-line text-[16px] leading-snug text-white/80">{t.body}</div>
        </div>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-[#0c0d12] text-white" data-testid="stage">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-violet-300">Party Queue · Stage</div>
          <div className="text-[24px] font-bold">Five agents settle one night out</div>
        </div>
        <div className="flex -space-x-2">
          {view.members.map((m) => (
            <span key={m.id} title={m.name} className="rounded-full ring-2 ring-[#0c0d12]">
              <Avatar name={m.name} hue={m.hue} size={40} />
            </span>
          ))}
        </div>
        <span data-testid="stage-status" className={`rounded-full px-3 py-1 text-[13px] font-semibold ${status === "Locked" ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/80"}`}>
          {status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => (setShown(0), setReplaying(true))} className="rounded-[6px] bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/15">
            Replay
          </button>
          <button onClick={startDemo} data-testid="stage-start" className="rounded-[6px] bg-violet-500 px-3 py-1.5 text-[13px] font-semibold hover:bg-violet-400">
            Start demo party
          </button>
          <span className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">Hackathon prototype, not Facebook</span>
        </div>
      </header>

      {view.traces.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[20px] text-white/50">Waiting for a party to form…</div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col rounded-[14px] bg-white/[0.03] ring-1 ring-white/10">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-[18px] font-bold">Private</div>
              <div className="text-[13px] text-white/50">Each agent's own reasoning, code checks and verifier blocks. No member ever sees another's.</div>
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

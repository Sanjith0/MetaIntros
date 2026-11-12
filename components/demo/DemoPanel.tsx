"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";

interface Status {
  storeVersion: number;
  waiting: { userId: string; landmark: string }[];
  party: { id: string; status: string; round: number; plan: string | null; lockedBy: string | null; forced: boolean } | null;
  phones: { id: string; connected: boolean }[];
  settings: { simulateLatency: boolean; timeoutAgent: string | null; agentTimeoutMs: number; source: "live" | "recorded"; paceMs: number | null };
  mockModel: boolean;
  frameSource: "fixture" | "recorded-clip" | "tap-only";
}

interface Person {
  id: string;
  name: string;
  hue: number;
}

const PACES: { label: string; ms: number | null }[] = [
  { label: "Instant", ms: 0 },
  { label: "Brisk", ms: 300 },
  { label: "Stage", ms: 700 },
  { label: "Slow", ms: 1400 },
];

/** One screen to drive the demo: reset, pre-queue, lock, frames, model behaviour. */
export function DemoPanel({ people }: { people: Person[] }) {
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [flags, setFlags] = useState<{ name: string; on: boolean; default: boolean }[]>([]);
  useEffect(() => {
    fetch("/api/demo/flags", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { flags: typeof flags }) => setFlags(b.flags))
      .catch(() => {});
  }, []);
  const toggleFlag = async (name: string, on: boolean) => {
    const r = await fetch("/api/demo/flags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, value: on }) });
    if (r.ok) setFlags(((await r.json()) as { flags: typeof flags }).flags);
    setMsg(`${name} ${on ? "on" : "off"} (reload a page to see it)`);
  };
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/demo/status", { cache: "no-store" });
      if (r.ok) setSt((await r.json()) as Status);
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 800);
    return () => clearInterval(t);
  }, [refresh]);

  const act = async (label: string, url: string, init?: RequestInit) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, ...init });
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    setMsg(r.ok ? `${label}: done` : `${label}: ${body.error ?? r.status}`);
    void refresh();
  };
  const settings = (patch: Record<string, unknown>, label: string) => act(label, "/api/demo/settings", { body: JSON.stringify(patch) });

  const card = "rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]";
  const btn = "press rounded-[6px] px-3 py-2 text-[14px] font-semibold disabled:opacity-40";
  const grey = `${btn} bg-[var(--color-btn-2)] hover:bg-[var(--color-btn-2-hover)]`;
  const violet = `${btn} bg-[var(--color-pq)] text-white`;
  const on = (b: boolean) => `${btn} ${b ? "bg-[var(--color-on-bg)] text-[var(--color-on-ink)] ring-1 ring-[var(--color-on-ink)]/40" : "bg-[var(--color-btn-2)]"}`;

  const talking = st?.party && (st.party.status === "forming" || st.party.status === "talking");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {/* Run */}
        <section className={card}>
          <h2 className="text-[17px] font-bold">Run the demo</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={grey} data-testid="demo-reset" onClick={() => act("Reset", "/api/demo/reset")}>
              Reset everything
            </button>
            <button className={grey} data-testid="demo-queue-four" onClick={() => act("Queued four", "/api/demo/start", { body: JSON.stringify({ mode: "four" }) })}>
              Pre-queue Dev, Ana, Kai, Zoe
            </button>
            <button className={violet} data-testid="demo-run-all" onClick={() => act("Party started", "/api/demo/start", { body: JSON.stringify({ mode: "all" }) })}>
              Queue all five (start the talk)
            </button>
            <button className={grey} data-testid="demo-clash" onClick={() => act("Queued five whose rules clash", "/api/demo/start", { body: JSON.stringify({ mode: "clash" }) })}>
              Show a no-match (rules clash)
            </button>
            <button className={grey} data-testid="demo-standing" onClick={() => act("Standing party set up for Sunday", "/api/demo/standing")}>
              Standing party queues again (Sun)
            </button>
            <button className={`${btn} bg-[var(--color-ink)] text-white`} data-testid="demo-lock" disabled={!talking} onClick={() => act("Lock now", "/api/demo/lock")}>
              Lock now
            </button>
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-ink-2)]">
            Lock now: code picks the best plan that passes every member's rules from what the agents have said so far, and the rest fast-forwards. Use it if a live model is slow.
          </p>
          {msg && (
            <div className="mt-2 text-[13px] font-semibold text-[var(--color-ink-3)]" data-testid="demo-msg">
              {msg}
            </div>
          )}
        </section>

        {/* Model behaviour */}
        <section className={card}>
          <h2 className="text-[17px] font-bold">How the agents answer</h2>
          <div className="mt-1 text-[13px] text-[var(--color-ink-2)]">Model: {st?.mockModel ? "deterministic mock (no key set)" : "Meta Model API"}</div>
          <div className="mt-3 text-[13px] font-semibold">Pace between steps</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {PACES.map((p) => (
              <button key={p.label} className={on(st?.settings.paceMs === p.ms)} data-testid={`pace-${p.label.toLowerCase()}`} onClick={() => settings({ paceMs: p.ms }, `Pace ${p.label}`)}>
                {p.label}
              </button>
            ))}
            <button className={on(st?.settings.paceMs === null)} onClick={() => settings({ paceMs: null }, "Pace from env")}>
              Default
            </button>
          </div>
          <div className="mt-3 text-[13px] font-semibold">Answers</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className={on(st?.settings.source === "live")} onClick={() => settings({ source: "live" }, "Live answers")}>
              Live
            </button>
            <button className={on(st?.settings.source === "recorded")} data-testid="demo-recorded" onClick={() => settings({ source: "recorded" }, "Recorded replay")}>
              Recorded replay
            </button>
            <button className={on(!!st?.settings.simulateLatency)} data-testid="demo-latency" onClick={() => settings({ simulateLatency: !st?.settings.simulateLatency }, "Network latency")}>
              Simulate network latency
            </button>
          </div>
          <div className="mt-3 text-[13px] font-semibold">Make one agent time out</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className={on(!st?.settings.timeoutAgent)} onClick={() => settings({ timeoutAgent: null }, "No timeouts")}>
              Nobody
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                className={on(st?.settings.timeoutAgent === p.id)}
                data-testid={`timeout-${p.id}`}
                onClick={() => settings({ timeoutAgent: p.id, agentTimeoutMs: 2500 }, `${p.name.split(" ")[0]} times out`)}
              >
                {p.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </section>

        {/* Door */}
        <section className={card}>
          <h2 className="text-[17px] font-bold">The door</h2>
          <div className="mt-2 text-[13px] font-semibold">Frame source</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className={on(st?.frameSource === "fixture")} data-testid="frames-fixture" onClick={() => act("Fixture frames", "/api/demo/frame-source", { body: JSON.stringify({ source: "fixture" }) })}>
              Fixture frames
            </button>
            <button className={on(st?.frameSource === "recorded-clip")} data-testid="frames-clip" onClick={() => act("Recorded clip", "/api/demo/frame-source", { body: JSON.stringify({ source: "recorded-clip" }) })}>
              Recorded clip
            </button>
            <button className={on(st?.frameSource === "tap-only")} data-testid="frames-tap-only" onClick={() => act("Camera off", "/api/demo/frame-source", { body: JSON.stringify({ source: "tap-only" }) })}>
              Camera off (tap only)
            </button>
          </div>
          <div className="mt-2">
            <button
              className={grey}
              data-testid="play-clip"
              disabled={st?.frameSource !== "recorded-clip" || st?.party?.status !== "locked"}
              onClick={() => act("Playing the recorded clip into Maya's door and glasses", "/api/demo/clip", { body: JSON.stringify({ viewerId: "maya" }) })}
            >
              ▶ Play the arrivals clip to Maya
            </button>
          </div>
          <div className="mt-3 text-[13px] font-semibold">After the event</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className={grey} data-testid="clock-after" onClick={() => act("Clock moved past the event", "/api/demo/clock", { body: JSON.stringify({ to: "after-event" }) })}>
              Jump past the event (chats close)
            </button>
            <button className={grey} data-testid="clock-now" onClick={() => act("Clock back to now", "/api/demo/clock", { body: JSON.stringify({ to: "now" }) })}>
              Back to now
            </button>
          </div>
          <div className="mt-3 text-[13px] font-semibold">Send a frame to Maya's door</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {people
              .filter((p) => p.id !== "maya")
              .map((p) => (
                <button
                  key={p.id}
                  className={grey}
                  disabled={st?.frameSource !== "fixture" || st?.party?.status !== "locked"}
                  data-testid={`frame-${p.id}`}
                  onClick={() => act(`${p.name.split(" ")[0]} at the door`, "/api/demo/frame", { body: JSON.stringify({ subjectId: p.id, viewerId: "maya" }) })}
                >
                  {p.name.split(" ")[0]} arrives
                </button>
              ))}
          </div>
        </section>
      </div>

      {/* Status */}
      <aside className="space-y-4">
        {flags.length > 0 && (
          <section className={card} data-testid="demo-flags">
            <h2 className="text-[17px] font-bold">Layers</h2>
            <p className="text-[12px] text-[var(--color-ink-2)]">Every feature is a layer behind a flag. Switch one off and the app still works.</p>
            <ul className="mt-2 space-y-1">
              {flags.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-mono">{f.name}</span>
                  <button
                    role="switch"
                    aria-checked={f.on}
                    aria-label={f.name}
                    data-testid={`flag-${f.name}`}
                    onClick={() => toggleFlag(f.name, !f.on)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${f.on ? "bg-[var(--color-pq)]" : "bg-[var(--color-btn-2-hover)]"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${f.on ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className={card} data-testid="demo-status">
          <h2 className="text-[17px] font-bold">Right now</h2>
          <dl className="mt-2 space-y-1.5 text-[14px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-ink-2)]">Waiting in the queue</dt>
              <dd className="font-semibold" data-testid="demo-waiting">
                {st?.waiting.length ?? 0}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-ink-2)]">Party</dt>
              <dd className="font-semibold" data-testid="demo-party-status">
                {st?.party ? `${st.party.status}${st.party.status === "talking" ? ` · round ${st.party.round}` : ""}` : "none"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-ink-2)]">Plan</dt>
              <dd className="text-right font-semibold" data-testid="demo-plan">
                {st?.party?.plan ? `${st.party.plan} (${st.party.lockedBy === "signatures" ? "five signatures" : st.party.forced ? "locked by operator" : "code fallback"})` : "not yet"}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(st?.waiting ?? []).map((w) => byId[w.userId] && <Avatar key={w.userId} name={byId[w.userId]!.name} hue={byId[w.userId]!.hue} size={28} />)}
          </div>
        </section>
        <section className={card}>
          <h2 className="text-[17px] font-bold">Phones</h2>
          <ul className="mt-2 space-y-1">
            {(st?.phones ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[14px]">
                <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-[var(--color-positive)]" : "bg-[var(--color-btn-2-hover)]"}`} />
                {byId[p.id]?.name ?? p.id}
                <a href={`/join/${p.id}`} target="_blank" className="ml-auto text-[12px] font-semibold text-[var(--color-link)]">
                  open as
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-[13px] font-semibold text-[var(--color-link)]">
            <a href="/stage" target="_blank">Stage</a>
            <a href="/phones" target="_blank">Phones board</a>
            <a href="/door" target="_blank">Door</a>
          </div>
        </section>
      </aside>
    </div>
  );
}

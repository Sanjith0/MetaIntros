"use client";

import { useEffect, useRef, useState } from "react";
import { heldWords, type LeakAttempt } from "@/lib/stage/leak";
import type { Person } from "@/lib/server/social";

/** Ready-made attempts for the presenter, so the room sees both sides of the verifier. */
function presets(members: Person[]): { label: string; actorId: string; text: string }[] {
  const maya = members.find((m) => m.id === "maya") ?? members[0];
  const dev = members.find((m) => m.id === "dev") ?? members[1] ?? members[0];
  if (!maya || !dev) return [];
  return [
    { label: `${dev.firstName} tells the table ${maya.firstName}'s limits`, actorId: dev.id, text: `heads up, ${maya.firstName} said out by eleven and nowhere I have to drink` },
    { label: "A neutral phrase with a hint added", actorId: dev.id, text: "That works for me. Someone here is on a budget though." },
    { label: "A neutral phrase, exactly", actorId: dev.id, text: "That works for me." },
  ];
}

/** "Try to leak it" on the projector: type a line as any agent, watch the verifier decide. Nothing is posted. */
export function LeakTest({ partyId, members }: { partyId: string | null; members: Person[] }) {
  const [open, setOpen] = useState(false);
  const [actorId, setActorId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeakAttempt | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const name = (id: string) => members.find((m) => m.id === id)?.firstName ?? id;

  const show = () => {
    const p = presets(members)[0];
    setActorId(p?.actorId ?? members[0]?.id ?? "");
    setText(p?.text ?? "");
    setResult(null);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const run = async () => {
    if (!partyId || !text.trim()) return;
    setBusy(true);
    const r = await fetch("/api/stage/attempt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partyId, actorId, text }) });
    setBusy(false);
    if (r.ok) setResult((await r.json()) as LeakAttempt);
  };

  if (!partyId || members.length === 0) return null;
  return (
    <>
      <button onClick={show} data-testid="leak-open" className="rounded-[6px] bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-red-700">
        Try to leak it
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Try to leak it" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-[720px] rounded-[14px] bg-[#14151c] ring-1 ring-white/15" data-testid="leak-test">
            <div className="flex items-start gap-3 border-b border-white/10 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-red-300">Try to leak it</div>
                <div className="text-[18px] font-bold">Type a line as any agent, the way a model that ignored its instructions might</div>
                <div className="mt-1 text-[13px] text-white/70">It goes through the same verifier as every line at the table. This is a test: nothing is posted and no phone hears it.</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-[6px] bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/20">
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2">
                {presets(members).map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setActorId(p.actorId);
                      setText(p.text);
                      setResult(null);
                    }}
                    className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85 hover:bg-white/20"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label className="block text-[13px] font-semibold text-white/80">
                Speaking as
                <select value={actorId} onChange={(e) => setActorId(e.target.value)} data-testid="leak-actor" className="ml-2 rounded-[6px] bg-white/10 px-2 py-1 text-[14px] text-white">
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#14151c]">
                      {m.firstName}&apos;s agent
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[13px] font-semibold text-white/80">
                The line
                <textarea
                  ref={inputRef}
                  value={text}
                  maxLength={280}
                  rows={2}
                  onChange={(e) => {
                    setText(e.target.value);
                    setResult(null);
                  }}
                  data-testid="leak-text"
                  className="mt-1 block w-full resize-none rounded-[8px] bg-white/10 p-2.5 text-[15px] font-normal text-white placeholder:text-white/40"
                />
              </label>
              <button onClick={run} disabled={busy || !text.trim()} data-testid="leak-run" className="rounded-[6px] bg-violet-700 px-4 py-2 text-[14px] font-semibold hover:bg-violet-700 disabled:opacity-50">
                {busy ? "Checking…" : "Send it to the table"}
              </button>
              {result && (
                <div data-testid="leak-result" data-ok={result.ok} className={`rounded-[10px] p-3 ring-1 ${result.ok ? "bg-emerald-400/10 ring-emerald-400/30" : "bg-red-500/10 ring-red-500/40"}`}>
                  <div className={`text-[16px] font-bold ${result.ok ? "text-emerald-200" : "text-red-200"}`}>
                    {result.ok ? "Let through: it's an approved line or a neutral phrase" : `Blocked by the verifier: ${result.plain}`}
                  </div>
                  {result.holds.length > 0 && (
                    <div className="mt-1 text-[14px] text-red-100" data-testid="leak-holds">
                      It held {heldWords(result.holds)}.
                    </div>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[8px] bg-black/30 p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{name(result.actorId)}&apos;s agent tried</div>
                      <div className={`text-[14px] ${result.ok ? "text-white" : "text-white/70 line-through decoration-red-400"}`}>{result.text}</div>
                    </div>
                    <div className="rounded-[8px] bg-black/30 p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">The other four would see</div>
                      <div className="text-[14px] text-white" data-testid="leak-table-sees">
                        {result.tableSees}
                      </div>
                    </div>
                  </div>
                  {result.promptOthers !== null && (
                    <div className="mt-2 text-[13px] text-white/70" data-testid="leak-prompt">
                      {result.promptOthers === 0
                        ? `And ${name(result.actorId)}'s agent never had anyone else's words: its last prompt held its own brief only.`
                        : `${name(result.actorId)}'s agent's last prompt held ${result.promptOthers} of someone else's private phrases.`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

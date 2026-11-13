"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Lock, Timer, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { stripCitations } from "@/lib/companion/text";

export interface CheckInView {
  id: string;
  kind: "picks" | "signoff";
  secondsLeft: number;
  picks?: { targetSize: number; picks: { id: string; score: number; why: string }[]; others: { id: string; score: number }[] };
  signoff?: { members: string[]; recommend: "yes" | "yes_if" | "no"; companionSaid: string; groupLines: { from: string; say: string }[] };
}

type People = Record<string, { name: string; avatarColor: string }>;

const first = (n?: string) => (n ?? "Someone").split(" ")[0];

/** The question a person's Companion is waiting on. If they don't answer in time, it goes ahead on its own. */
export function CheckInCard({ checkIn, people, meId, onSent }: { checkIn: CheckInView; people: People; meId?: string; onSent?: () => void }) {
  const [left, setLeft] = useState(checkIn.secondsLeft);
  const [drop, setDrop] = useState<string[]>([]);
  const [told, setTold] = useState("");
  const [sent, setSent] = useState<null | "sent" | "error" | "sensitive">(null);
  const [busy, setBusy] = useState(false);

  // A new check-in starts fresh; polls of the same one must not wipe what the person is typing.
  useEffect(() => {
    setLeft(checkIn.secondsLeft);
    setSent(null);
    setDrop([]);
    setTold("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn.id]);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [checkIn.id]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fetch("/api/queue/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: checkIn.id, ...body }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      onSent?.();
      return setSent("sent");
    }
    const j = await r?.json().catch(() => null);
    setSent(j?.error === "sensitive" ? "sensitive" : "error");
  };

  const name = (id: string) => first(people[id]?.name);
  const countdown = (
    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#c7d2fe]" data-testid="checkin-countdown">
      <Timer size={11} /> {left > 0 ? `Your Companion goes ahead on its own in ${left}s` : "Your Companion is going ahead"}
    </p>
  );

  if (sent === "sent") return <CheckInSent />;

  return (
    <div className="mt-4 rounded-2xl bg-[#a855f7]/20 p-3 ring-2 ring-[#a855f7]" data-testid="checkin-card" data-kind={checkIn.kind}>
      {checkIn.kind === "picks" && checkIn.picks && (
        <>
          <p className="flex items-center gap-1.5 text-sm font-extrabold"><Bot size={16} /> Your Companion is checking with you</p>
          <p className="mt-0.5 text-xs text-[#ddd6fe]">Here&apos;s who it would put in your squad of {checkIn.picks.targetSize}. Drop anyone you don&apos;t want, and tell it anything it got wrong about you.</p>
          {countdown}
          <ul className="mt-2 space-y-1.5">
            {checkIn.picks.picks.map((p) => {
              const out = drop.includes(p.id);
              return (
                <li key={p.id} className={`flex items-center gap-2 rounded-xl p-2 ${out ? "bg-black/30 opacity-60" : "bg-white/10"}`} data-testid="checkin-pick">
                  <Avatar name={people[p.id]?.name ?? "?"} color={people[p.id]?.avatarColor} size={30} />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block text-sm font-bold">{name(p.id)} <span className="font-normal text-[#c7d2fe]">· {p.score}</span></span>
                    {p.why && <span className="block truncate text-[#ddd6fe]">{stripCitations(p.why)}</span>}
                  </span>
                  <button type="button" aria-pressed={out} data-testid="checkin-drop" onClick={() => setDrop((d) => (out ? d.filter((x) => x !== p.id) : [...d, p.id]))}
                    className={`flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold ${out ? "bg-rose-500/80" : "bg-white/15"}`}>
                    {out ? <><X size={13} /> Dropped</> : "Drop"}
                  </button>
                </li>
              );
            })}
          </ul>
          <label htmlFor="checkin-told" className="mt-3 block text-xs font-semibold">Anything it got wrong about you, or what you actually want?</label>
          <textarea id="checkin-told" data-testid="checkin-told" rows={2} value={told} onChange={(e) => setTold(e.target.value.slice(0, 200))}
            placeholder="e.g. I'm not low-key tonight, I want to dance"
            className="mt-1 w-full resize-none rounded-xl bg-white/10 p-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#a855f7]" />
          <p className="flex items-center gap-1 text-[10px] text-[#c7d2fe]"><Lock size={10} /> Only your Companion reads this, and it remembers it for next time.</p>
          {sent === "sensitive" && <p className="mt-1 text-xs text-amber-200">Keep it to plans and vibe: no health, religion, politics or sexuality.</p>}
          {sent === "error" && <p className="mt-1 text-xs text-amber-200">Too late or couldn&apos;t send. Your Companion went ahead.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} data-testid="checkin-looks-right" onClick={() => send({ drop: [] })} className="rounded-xl bg-white/15 py-2.5 text-sm font-bold disabled:opacity-60">Looks right</button>
            <button type="button" disabled={busy || (!drop.length && !told.trim())} data-testid="checkin-send" onClick={() => send({ drop, told })} className="rounded-xl bg-white py-2.5 text-sm font-bold text-[#5b21b6] disabled:opacity-60">Send to my Companion</button>
          </div>
        </>
      )}

      {checkIn.kind === "signoff" && checkIn.signoff && (
        <>
          <p className="flex items-center gap-1.5 text-sm font-extrabold"><Bot size={16} /> Your squad is ready. Are you in?</p>
          <p className="mt-1 text-sm">{checkIn.signoff.members.filter((m) => m !== meId).map(name).join(", ")} and you</p>
          <p className="mt-1 text-xs text-[#ddd6fe]" data-testid="checkin-recommend">
            Your Companion recommends: <b>{checkIn.signoff.recommend === "no" ? "not this group" : "I'm in"}</b>
            {checkIn.signoff.companionSaid && <span className="block italic">&ldquo;{stripCitations(checkIn.signoff.companionSaid)}&rdquo;</span>}
          </p>
          {countdown}
          {sent === "error" && <p className="mt-1 text-xs text-amber-200">Too late or couldn&apos;t send. Your Companion&apos;s call stood.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} data-testid="checkin-no" onClick={() => send({ decision: "no" })} className="rounded-xl bg-white/15 py-2.5 text-sm font-bold disabled:opacity-60">Not this group</button>
            <button type="button" disabled={busy} data-testid="checkin-yes" onClick={() => send({ decision: "yes" })} className="rounded-xl bg-white py-2.5 text-sm font-bold text-[#5b21b6] disabled:opacity-60">I&apos;m in</button>
          </div>
          <p className="mt-1 text-[10px] text-[#c7d2fe]">If you say no, nobody is told it was you.</p>
        </>
      )}
    </div>
  );
}

export function CheckInSent() {
  return (
    <div className="mt-4 rounded-2xl bg-emerald-400/15 p-3 text-sm ring-1 ring-emerald-300/40" data-testid="checkin-sent">
      <p className="flex items-center gap-1.5 font-semibold"><Check size={15} /> Got it. Your Companion is using what you said.</p>
    </div>
  );
}

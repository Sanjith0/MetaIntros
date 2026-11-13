"use client";

import { useEffect, useState } from "react";
import { Check, Lock, Timer } from "lucide-react";
import { AiLabel, Avatar, Button } from "@/components/fb";
import { stripCitations } from "@/lib/companion/text";

export interface CheckInView {
  id: string;
  kind: "picks" | "signoff";
  secondsLeft: number;
  picks?: { targetSize: number; picks: { id: string; score: number; why: string }[]; others: { id: string; score: number }[] };
  signoff?: { members: string[]; recommend: "yes" | "yes_if" | "no"; companionSaid: string; groupLines: { from: string; say: string }[] };
}

type People = Record<string, { name: string; avatarColor: string; anonymous?: boolean }>;

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
    <p className="mt-1 flex items-center gap-1 text-meta text-muted" data-testid="checkin-countdown">
      <Timer size={12} /> {left > 0 ? `Your Companion goes ahead on its own in ${left}s` : "Your Companion is going ahead"}
    </p>
  );

  if (sent === "sent") return <CheckInSent />;

  return (
    <div className="mt-3 rounded-card border border-accent bg-surface p-3" data-testid="checkin-card" data-kind={checkIn.kind}>
      {checkIn.kind === "picks" && checkIn.picks && (
        <>
          <p className="text-title">Your Companion is checking with you</p>
          <p className="mt-0.5 text-body text-muted">Here&apos;s who it would put in your squad of {checkIn.picks.targetSize}. Drop anyone you don&apos;t want, and tell it anything it got wrong about you.</p>
          {countdown}
          <ul className="mt-2 divide-y divide-divider">
            {checkIn.picks.picks.map((p) => {
              const out = drop.includes(p.id);
              return (
                <li key={p.id} className={`flex items-center gap-2 py-2 ${out ? "opacity-50" : ""}`} data-testid="checkin-pick">
                  <Avatar name={people[p.id]?.name ?? "?"} color={people[p.id]?.avatarColor} size={40} blurred={people[p.id]?.anonymous} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold">{name(p.id)} <span className="font-normal text-muted">· {p.score}</span></span>
                    {p.why && <span className="block truncate text-meta text-muted">{stripCitations(p.why)}</span>}
                  </span>
                  <Button size="sm" aria-pressed={out} data-testid="checkin-drop" onClick={() => setDrop((d) => (out ? d.filter((x) => x !== p.id) : [...d, p.id]))}>
                    {out ? "Undo" : "Drop"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <label htmlFor="checkin-told" className="mt-3 block text-body font-semibold">Anything it got wrong about you, or what you actually want?</label>
          <textarea id="checkin-told" data-testid="checkin-told" rows={2} value={told} onChange={(e) => setTold(e.target.value.slice(0, 200))}
            placeholder="e.g. I'm not low-key tonight, I want to dance"
            className="mt-1 w-full resize-none rounded-btn bg-wash p-2.5 text-body text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
          <p className="mt-0.5 flex items-center gap-1 text-meta text-muted"><Lock size={12} /> Only your Companion reads this, and it remembers it for next time.</p>
          {sent === "sensitive" && <p className="mt-1 text-meta text-badge">Keep it to plans and vibe: no health, religion, politics or sexuality.</p>}
          {sent === "error" && <p className="mt-1 text-meta text-muted">Too late or couldn&apos;t send. Your Companion went ahead.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button block disabled={busy} data-testid="checkin-looks-right" onClick={() => send({ drop: [] })}>Looks right</Button>
            <Button block variant="primary" disabled={busy || (!drop.length && !told.trim())} data-testid="checkin-send" onClick={() => send({ drop, told })}>Send</Button>
          </div>
        </>
      )}

      {checkIn.kind === "signoff" && checkIn.signoff && (
        <>
          <p className="text-title">Your squad is ready. Are you in?</p>
          <p className="mt-1 text-body">{checkIn.signoff.members.filter((m) => m !== meId).map(name).join(", ")} and you</p>
          <p className="mt-1 text-body text-muted" data-testid="checkin-recommend">
            Your Companion recommends: <b className="text-ink">{checkIn.signoff.recommend === "no" ? "not this group" : "I'm in"}</b>
          </p>
          {checkIn.signoff.companionSaid && (
            <p className="mt-1 text-body">&ldquo;{stripCitations(checkIn.signoff.companionSaid)}&rdquo; <AiLabel className="ml-1" /></p>
          )}
          {countdown}
          {sent === "error" && <p className="mt-1 text-meta text-muted">Too late or couldn&apos;t send. Your Companion&apos;s call stood.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button block disabled={busy} data-testid="checkin-no" onClick={() => send({ decision: "no" })}>Not this group</Button>
            <Button block variant="primary" disabled={busy} data-testid="checkin-yes" onClick={() => send({ decision: "yes" })}>I&apos;m in</Button>
          </div>
          <p className="mt-1 text-meta text-muted">If you say no, nobody is told it was you.</p>
        </>
      )}
    </div>
  );
}

export function CheckInSent() {
  return (
    <p role="status" className="mt-3 flex items-center gap-1.5 rounded-card bg-wash p-3 text-body" data-testid="checkin-sent">
      <Check size={16} className="text-positive" /> Got it. Your Companion is using what you said.
    </p>
  );
}

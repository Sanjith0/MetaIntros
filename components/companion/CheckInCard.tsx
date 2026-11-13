"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Lock, Timer } from "lucide-react";
import { Avatar, Button } from "@/components/fb";
import { stripCitations } from "@/lib/companion/text";
import { CompanionThread, type ThreadLine } from "./CompanionThread";

export interface CheckInView {
  id: string;
  kind: "picks" | "objection";
  secondsLeft: number;
  picks?: { targetSize: number; picks: { id: string; score: number; why: string; enjoy?: string[]; concerns?: string[]; needs?: string[] }[]; others: { id: string; score: number }[] };
  /** before your Companion turns down something someone suggested, it asks you */
  objection?: { items: { with: string; activity: string; asked: string; companionThinks: string }[] };
}

type People = Record<string, { name: string; avatarColor: string; anonymous?: boolean }>;

const first = (n?: string) => (n ?? "Someone").split(" ")[0];

/** The question a person's Companion is waiting on. If they don't answer in time, it goes ahead on its own. */
/** `threads`: your Companion's conversation with each person, so a pick can be read in full before you decide. */
export function CheckInCard({ checkIn, people, threads, onSent }: { checkIn: CheckInView; people: People; meId?: string; threads?: Record<string, ThreadLine[]>; onSent?: () => void }) {
  const [left, setLeft] = useState(checkIn.secondsLeft);
  const [drop, setDrop] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [up, setUp] = useState<string[]>([]);
  const [told, setTold] = useState("");
  const [sent, setSent] = useState<null | "sent" | "error" | "sensitive">(null);
  const [busy, setBusy] = useState(false);

  // A new check-in starts fresh; polls of the same one must not wipe what the person is typing.
  useEffect(() => {
    setLeft(checkIn.secondsLeft);
    setSent(null);
    setDrop([]);
    setOpen(null);
    setUp([]);
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
          <p className="mt-0.5 text-body text-muted">Here&apos;s who it would put in your squad of {checkIn.picks.targetSize}. Tap someone to read what your Companion learned about them. Drop anyone you don&apos;t want, and tell it anything it got wrong about you.</p>
          {countdown}
          <ul className="mt-2 divide-y divide-divider">
            {checkIn.picks.picks.map((p) => {
              const out = drop.includes(p.id);
              const isOpen = open === p.id;
              const lines = threads?.[p.id] ?? [];
              return (
                <li key={p.id} className="py-2" data-testid="checkin-pick">
                  <div className={`flex items-center gap-2 ${out ? "opacity-50" : ""}`}>
                    <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen} data-testid="checkin-pick-toggle" onClick={() => setOpen(isOpen ? null : p.id)}>
                      <Avatar name={people[p.id]?.name ?? "?"} color={people[p.id]?.avatarColor} size={40} blurred={people[p.id]?.anonymous} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold">{name(p.id)} <span className="font-normal text-muted">· {p.score}</span></span>
                        {p.why && <span className={`block text-meta text-muted ${isOpen ? "" : "truncate"}`}>{stripCitations(p.why)}</span>}
                      </span>
                      <ChevronDown size={18} className={`shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <Button size="sm" aria-pressed={out} data-testid="checkin-drop" onClick={() => setDrop((d) => (out ? d.filter((x) => x !== p.id) : [...d, p.id]))}>
                      {out ? "Undo" : "Drop"}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="mt-2 space-y-2" data-testid="checkin-pick-detail">
                      <div className="rounded-card bg-wash p-2.5 text-body">
                        <p className="text-meta font-semibold text-muted">Your Companion&apos;s private read on {name(p.id)}</p>
                        {(p.enjoy ?? []).map((t, i) => <p key={`e${i}`} className="mt-1">You&apos;d enjoy: {stripCitations(t)}</p>)}
                        {(p.concerns ?? []).map((t, i) => <p key={`c${i}`} className="mt-1">Watch out: {stripCitations(t)}</p>)}
                        {(p.needs ?? []).map((t, i) => <p key={`n${i}`} className="mt-1">You&apos;d need: {stripCitations(t)}</p>)}
                        {!p.enjoy?.length && !p.concerns?.length && !p.needs?.length && <p className="mt-1 text-muted">No notes yet.</p>}
                      </div>
                      {lines.length > 0 && (
                        <>
                          <p className="text-meta font-semibold text-muted">What the two Companions said</p>
                          <CompanionThread lines={lines} otherName={name(p.id)} />
                        </>
                      )}
                    </div>
                  )}
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

      {checkIn.kind === "objection" && checkIn.objection && (
        <>
          <p className="text-title">Quick question from your Companion</p>
          <p className="mt-0.5 text-body text-muted">Before it says no for you, it wants to check.</p>
          {countdown}
          <ul className="mt-2 divide-y divide-divider">
            {checkIn.objection.items.map((o) => {
              const yes = up.includes(o.with);
              return (
                <li key={o.with} className="py-2" data-testid="objection-item">
                  <div className="flex items-start gap-2">
                    <Avatar name={people[o.with]?.name ?? "?"} color={people[o.with]?.avatarColor} size={32} blurred={people[o.with]?.anonymous} />
                    <div className="min-w-0 flex-1">
                      <p className="text-body"><span className="font-semibold">{name(o.with)}&apos;s Companion asked:</span> &ldquo;{stripCitations(o.asked)}&rdquo;</p>
                      <p className="mt-1 text-body">Your Companion thinks you wouldn&apos;t be into <b>{o.activity}</b>. Would you?</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button block size="sm" variant={yes ? "secondary" : "primary"} aria-pressed={!yes} data-testid="objection-not-for-me" onClick={() => setUp((u) => u.filter((x) => x !== o.with))}>Not for me</Button>
                    <Button block size="sm" variant={yes ? "primary" : "secondary"} aria-pressed={yes} data-testid="objection-up-for-it" onClick={() => setUp((u) => (yes ? u : [...u, o.with]))}>I&apos;d be up for it</Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {sent === "error" && <p className="mt-1 text-meta text-muted">Too late or couldn&apos;t send. Your Companion went with its guess.</p>}
          <Button block variant="primary" className="mt-2" disabled={busy} data-testid="objection-send" onClick={() => send({ up })}>Send</Button>
          <p className="mt-1 flex items-center gap-1 text-meta text-muted"><Lock size={12} /> Only your Companion sees your answer.</p>
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

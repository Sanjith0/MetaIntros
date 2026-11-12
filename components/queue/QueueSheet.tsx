"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HardRule, Preference, ShareableLine } from "@/contracts";
import { IconSparkle } from "@/components/icons";
import { useLiveEvents } from "@/components/live/LiveProvider";
import { clock12 } from "@/lib/format";

interface Preview {
  hardRules: HardRule[];
  preferences: Preference[];
  lines: ShareableLine[];
}

interface Status {
  joinedAt: string;
  inBucket: number;
  needed: number;
  partyId: string | null;
  landmark: string;
}

const ruleLabel = (r: HardRule) => {
  switch (r.kind) {
    case "end_by":
      return `Done by ${clock12(r.value)}`;
    case "max_price":
      return `$${r.value} or less`;
    case "no_drink_minimum":
      return "No drink minimum";
    case "public_venue":
      return "Public place only";
  }
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The queue sheet: one sentence, a private preview, approvals, and then a
 *  live timer. You can leave the page; the notification will find you. */
export function QueueSheet({ eventId, landmark, initialStatus, placeholder }: { eventId: string; landmark: string; initialStatus: Status | null; placeholder: string }) {
  const [sentence, setSentence] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(true);
  const [status, setStatus] = useState<Status | null>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [forming, setForming] = useState<string | null>(initialStatus?.partyId ?? null);
  const seq = useRef(0);
  const now = useNow(!!status && !forming);

  useEffect(() => {
    const text = sentence.trim();
    if (text.length < 3) {
      setPreview(null);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await fetch("/api/brief/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sentence: text }) });
      if (!res.ok || mine !== seq.current) return;
      const p = (await res.json()) as Preview;
      setPreview(p);
      setApproved((prev) => Object.fromEntries(p.lines.map((l) => [l.id, prev[l.id] ?? true])));
    }, 250);
    return () => clearTimeout(t);
  }, [sentence]);

  useLiveEvents((e) => {
    if (e.type === "queue.tick") setStatus((s) => (s ? { ...s, inBucket: e.payload.inBucket, needed: e.payload.needed } : s));
    if (e.type === "party.forming") setForming(e.payload.partyId);
  });

  const join = async () => {
    setJoining(true);
    setError(null);
    const res = await fetch("/api/queue/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, sentence, consentBridges: consent, approvedLineIds: Object.keys(approved).filter((k) => approved[k]) }),
    });
    const body = (await res.json()) as { error?: string; partyId?: string | null };
    setJoining(false);
    if (!res.ok) {
      setError(body.error ?? "Could not join the queue.");
      return;
    }
    const st = (await (await fetch("/api/queue/status")).json()) as { status: { entry: { joinedAt: string; landmark: string }; inBucket: number; needed: number; partyId: string | null } | null };
    if (st.status) setStatus({ joinedAt: st.status.entry.joinedAt, inBucket: st.status.inBucket, needed: st.status.needed, partyId: st.status.partyId, landmark: st.status.entry.landmark });
    if (body.partyId) setForming(body.partyId);
  };

  const leave = async () => {
    await fetch("/api/queue/leave", { method: "POST" });
    setStatus(null);
  };

  const waited = useMemo(() => (status ? Math.max(0, Math.round((now - Date.parse(status.joinedAt)) / 1000)) : 0), [now, status]);

  if (status || forming) {
    return (
      <div className="p-5" data-testid="queue-waiting">
        {forming ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-pq-soft)] text-[var(--color-pq)]">
              <IconSparkle size={28} />
            </div>
            <div className="text-[20px] font-bold" data-testid="party-forming">
              Your party of five is forming
            </div>
            <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">Your agents are talking it over. You'll get a notification the moment the plan is locked.</p>
            <Link href="/party" className="press mt-4 inline-flex rounded-[6px] bg-[var(--color-pq)] px-4 py-2 text-[15px] font-semibold text-white">
              Watch your party
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">In the queue near {status!.landmark}</div>
            <div className="my-2 font-mono text-[44px] font-bold tabular-nums" data-testid="queue-timer">
              {mmss(waited)}
            </div>
            <div className="mx-auto mb-3 flex max-w-[260px] justify-center gap-1.5" aria-label={`${status!.inBucket} of 5 here`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`h-2.5 flex-1 rounded-full ${i < status!.inBucket ? "bg-[var(--color-pq)]" : "bg-[var(--color-btn-2)]"}`} />
              ))}
            </div>
            <p className="text-[15px] text-[var(--color-ink-2)]" data-testid="queue-count">
              {status!.inBucket} of 5 here · waiting for {status!.needed} more
            </p>
            <p className="mt-3 text-[13px] text-[var(--color-ink-2)]">You can leave this page. We'll notify you when your party is set.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/events" className="press rounded-[6px] bg-[var(--color-btn-2)] px-4 py-2 text-[15px] font-semibold">
                Back to Events
              </Link>
              <button onClick={leave} className="press rounded-[6px] px-4 py-2 text-[15px] font-semibold text-[var(--color-ink-2)] hover:bg-black/5">
                Leave queue
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-5">
      <label htmlFor="sentence" className="text-[17px] font-semibold">
        Describe your night in one sentence
      </label>
      <textarea
        id="sentence"
        data-testid="sentence"
        value={sentence}
        maxLength={280}
        onChange={(e) => setSentence(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full resize-none rounded-[8px] border border-[var(--color-divider)] bg-white px-3 py-2 text-[17px] outline-none focus:border-[var(--color-pq)] focus:ring-2 focus:ring-[var(--color-pq-soft)]"
      />

      {preview && (
        <div className="mt-3 rounded-[8px] border border-[var(--color-divider)]" data-testid="brief-preview">
          <div className="border-b border-[var(--color-divider)] bg-[var(--color-wash)] px-3 py-2 text-[13px] font-semibold text-[var(--color-ink-2)]">Your brief · only you see this part</div>
          <div className="space-y-3 p-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--color-ink-3)]">Private rules your agent will hold to</div>
              {preview.hardRules.length === 0 ? (
                <div className="text-[13px] text-[var(--color-ink-2)]">None found.</div>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {preview.hardRules.map((r) => (
                    <li key={r.id} className="rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-[13px] font-semibold text-white">
                      {ruleLabel(r)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 text-[12px] text-[var(--color-ink-2)]">Never shown to your party. If a plan breaks one, they only see "unavailable".</div>
            </div>
            {preview.preferences.length > 0 && (
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-ink-3)]">What you're hoping for</div>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {preview.preferences.map((p) => (
                    <li key={p.id} className="rounded-full bg-[var(--color-btn-2)] px-2.5 py-1 text-[13px] font-semibold">
                      {p.tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="text-[13px] font-semibold text-[var(--color-ink-3)]">Lines your agent may share with the party</div>
              <ul className="mt-1 space-y-1">
                {preview.lines.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-[6px] px-1 py-1 hover:bg-black/5">
                      <input
                        type="checkbox"
                        data-testid={`approve-${l.id}`}
                        checked={!!approved[l.id]}
                        onChange={(e) => setApproved((a) => ({ ...a, [l.id]: e.target.checked }))}
                        className="mt-1 accent-[var(--color-pq)]"
                      />
                      <span className="text-[15px]">{l.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-[var(--color-ink-2)]">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-pq)]" data-testid="consent-bridges" />
        Let my party see how we're connected (a mutual friend or a small Group we share).
      </label>

      {error && <div className="mt-3 rounded-[6px] bg-[#fdecef] px-3 py-2 text-[13px] text-[var(--color-badge)]">{error}</div>}

      <button
        data-testid="join-queue"
        disabled={sentence.trim().length < 3 || joining}
        onClick={join}
        className="press mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-[var(--color-pq)] text-[15px] font-semibold text-white disabled:opacity-40"
      >
        <IconSparkle size={18} /> {joining ? "Joining…" : "Find my party"}
      </button>
      <p className="mt-2 text-center text-[12px] text-[var(--color-ink-2)]">Five people, each connected to someone else in the party through a friend or a small Group.</p>
    </div>
  );
}

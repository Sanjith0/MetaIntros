"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Check, DoorOpen, EyeOff, MapPinned, ShieldCheck } from "lucide-react";
import { Avatar, Button, ButtonLink, Card, IconCircle, ListRow, Section, Stack } from "@/components/fb";
import { TopBar } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";
import { EventCover } from "@/components/events/EventCover";
import { DateLine } from "@/components/events/DateLine";
import { TraceRow } from "@/components/trace/TraceList";
import { fmtDuration } from "@/lib/format";

interface Status {
  state: "idle" | "waiting" | "matched";
  targetSize?: number;
  mode?: "events" | "hangout";
  eventId?: string | null;
  bucketName?: string;
  bucketId?: string;
  /** set by the queue when it can't form a squad yet (main c75421b) */
  problem?: "no_events" | "event_started" | "no_fit";
  waitedMs?: number;
  found?: number;
  foundUsers?: { id: string; name: string; avatarColor: string }[];
  partyId?: string | null;
}

interface Party {
  id: string;
  members: { user: { id: string; name: string; avatarColor: string; isSimulated?: boolean; isLive?: boolean } }[];
  event: { id: string; title: string; startsAt: string; venueName: string; kind?: string; description?: string; coverColor?: string; coverPattern?: string } | null;
  landmark: { name: string };
  chat: { id: string } | null;
}

const first = (n: string) => n.split(" ")[0];

export function QueueScreen({ meId, eventTitle }: { meId: string; eventTitle: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const base = useRef<{ at: number; waited: number } | null>(null);

  const refresh = useCallback(async () => {
    const s: Status | null = await fetch("/api/queue/status").then((r) => r.json()).catch(() => null);
    if (!s) return;
    setStatus(s);
    if (s.state === "waiting" && s.waitedMs != null && !base.current) base.current = { at: Date.now(), waited: s.waitedMs };
    if (s.state === "matched" && s.partyId) {
      const p = await fetch(`/api/party/${s.partyId}`).then((r) => (r.ok ? r.json() : null));
      if (p) setParty(p);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (!party) refresh();
    }, 1200);
    return () => clearInterval(t);
  }, [refresh, party]);

  useEffect(() => {
    const t = setInterval(() => base.current && setElapsed(base.current.waited + Date.now() - base.current.at), 250);
    return () => clearInterval(t);
  }, []);

  useLiveEvents(["queue", "party"], () => {
    if (!party) refresh();
  });

  if (party) return <SquadFound party={party} meId={meId} />;
  if (!status)
    return (
      <div aria-busy="true">
        <TopBar back="/events" title="Finding your squad" />
      </div>
    );
  if (status.state === "idle")
    return (
      <div data-testid="queue-idle">
        <TopBar back="/events" title="Queue Up" />
        <Section className="py-8 text-center">
          <p className="text-body">You&apos;re not in a queue.</p>
          <ButtonLink href="/events" className="mt-3">Browse events</ButtonLink>
        </Section>
      </div>
    );

  const n = status.targetSize ?? 5;
  const found = Math.min(status.found ?? 1, n);
  const users = status.foundUsers ?? [];
  const widening = elapsed > 16_000 ? "Looking in nearby areas too" : elapsed > 8_000 ? "Widening the search a little" : "Looking for people you'd get along with";
  const kind = status.mode === "hangout" ? "New hangout" : status.eventId ? eventTitle ?? "This event" : "Any event this weekend";

  return (
    <div data-testid="queue-screen">
      <TopBar back="/events" title="Finding your squad" />
      <Stack>
        <Section>
          <div className="flex items-center gap-3" data-testid="queue-kind">
            <IconCircle tone="on">{status.mode === "hangout" ? <MapPinned size={18} /> : <CalendarDays size={18} />}</IconCircle>
            <span className="min-w-0">
              <span className="block truncate text-body font-semibold">{kind}</span>
              <span className="block text-meta text-muted">Near {status.bucketName} · squad of {n}</span>
            </span>
          </div>
          <p className="mt-4 text-center text-timer font-bold tabular-nums" data-testid="queue-timer" aria-label={`Waiting ${fmtDuration(elapsed)}`}>
            {fmtDuration(elapsed)}
          </p>
          <p className="text-center text-meta text-muted" aria-live="polite">{widening}</p>

          <p className="mt-5 text-body font-semibold" data-testid="players-found">
            {found} of {n} found
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-control" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={found} aria-label="Squad found so far">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(found / n) * 100}%` }} />
          </div>
          <ul className="mt-4 flex justify-between gap-2" data-testid="player-slots">
            {Array.from({ length: n }).map((_, i) => {
              const u = users[i];
              return (
                <li key={u?.id ?? `empty-${i}`} className="flex w-12 flex-col items-center gap-1">
                  {u ? (
                    <span className="animate-slot-in" data-testid="player-filled">
                      <Avatar name={i === 0 ? u.name : "Someone nearby"} color={u.avatarColor} size={48} blurred={i !== 0} />
                    </span>
                  ) : (
                    <span className="h-12 w-12 rounded-full border-2 border-dashed border-divider" data-testid="player-empty" aria-label="Open spot" />
                  )}
                  <span className="w-full truncate text-center text-[11px] text-muted">{u ? (i === 0 ? "You" : "Found") : ""}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-meta text-muted">You&apos;ll see who they are once your squad is ready.</p>
          {status.problem && <QueueProblem status={status} />}
        </Section>
        <Section flush title="While you wait">
          <ListRow leading={<IconCircle><EyeOff size={18} /></IconCircle>} title="Nobody sees you yet" subtitle="Your squad sees your first name once it's ready." />
          <ListRow leading={<IconCircle><ShieldCheck size={18} /></IconCircle>} title="Public places only" subtitle="Squads meet at the event's front entrance." />
          <ListRow leading={<IconCircle><DoorOpen size={18} /></IconCircle>} title="Leave any time" subtitle="Nobody is told why." />
          <div className="px-4 pt-2">
            <LeaveQueue />
          </div>
        </Section>
      </Stack>
    </div>
  );
}

const PROBLEM_TEXT: Record<NonNullable<Status["problem"]>, string> = {
  no_events: "There are no upcoming events left this weekend to sort your squad into.",
  event_started: "This event has already started, so we can't form a squad for it.",
  no_fit: "We found people, but no event works for everyone's free time and tastes yet. We'll keep trying.",
};

/** Why the queue can't form a squad yet, with one way forward (from main's queue no-fit handling). */
function QueueProblem({ status }: { status: Status }) {
  const [busy, setBusy] = useState(false);
  const hangout = status.mode === "hangout";
  const text =
    hangout && status.problem === "no_fit"
      ? "We found people, but no public spot near all of you works for everyone's free time yet. We'll keep trying."
      : PROBLEM_TEXT[status.problem!];
  const switchToHangout = async () => {
    setBusy(true);
    await fetch("/api/queue/join", {
      method: "POST",
      body: JSON.stringify({ mode: "hangout", eventId: null, targetSize: status.targetSize, landmarkId: status.bucketId, locationSource: "manual" }),
    }).catch(() => {});
    window.location.href = "/queue";
  };
  return (
    <div role="status" className="mt-3 rounded-card bg-wash p-3" data-testid="queue-problem" data-problem={status.problem}>
      <p className="text-body">{text}</p>
      {!hangout && (
        <Button block className="mt-2" disabled={busy} onClick={switchToHangout} data-testid="switch-to-hangout" icon={<MapPinned size={16} />}>
          Plan a new hangout instead
        </Button>
      )}
    </div>
  );
}

function LeaveQueue() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      block
      data-testid="leave-queue"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/queue/leave", { method: "POST" }).catch(() => {});
        router.push("/events");
        router.refresh();
      }}
    >
      Leave queue
    </Button>
  );
}

/** The one loud moment, drawn in Facebook's materials: a check that scales in once, people popping in. */
function SquadFound({ party, meId }: { party: Party; meId: string }) {
  const hangout = party.event?.kind === "hangout";
  const others = party.members.filter((m) => m.user.id !== meId);
  const hasSample = party.members.some((m) => m.user.isSimulated && !m.user.isLive && m.user.id !== meId);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div data-testid="party-found">
      <TopBar back="/events" title="Your squad" />
      <Stack>
        <Section className="pt-6 pb-4 text-center">
          <span className="relative mx-auto flex h-[88px] w-[88px] items-center justify-center">
            <span aria-hidden className="absolute inset-0 animate-ring-once rounded-full border-2 border-accent" />
            <span className="flex h-[88px] w-[88px] animate-check-in items-center justify-center rounded-full bg-accent text-surface">
              <Check size={48} strokeWidth={3} aria-hidden />
            </span>
          </span>
          <h1 ref={heading} tabIndex={-1} className="mt-4 text-page font-bold outline-none">Your squad is ready</h1>
          <p className="mt-1 text-body text-muted">
            {party.members.length} people{party.event ? (hangout ? " · a new hangout, just for you" : ` going to ${party.event.title} together`) : ""}
          </p>
          <ul className="mt-5 flex justify-center gap-2" data-testid="party-members">
            {party.members.map((m, i) => (
              <li key={m.user.id} className="flex w-14 animate-slot-in flex-col items-center gap-1" style={{ animationDelay: `${300 + i * 90}ms` }}>
                <Avatar name={m.user.name} color={m.user.avatarColor} size={48} />
                <span className="w-full truncate text-center text-meta">{m.user.id === meId ? "You" : first(m.user.name)}</span>
                {m.user.isSimulated && !m.user.isLive && m.user.id !== meId && <span className="text-[11px] text-muted" data-testid="sample-tag">Sample</span>}
              </li>
            ))}
          </ul>
          {hasSample && <p className="mt-2 text-meta text-muted">Sample people are simulated so the demo works with a small crowd.</p>}
        </Section>

        {party.event && (
          <Section>
            <Card testId="party-event">
              <Link href={`/events/${party.event.id}`} data-testid="view-event" className="block">
                {party.event.coverColor && <EventCover color={party.event.coverColor} pattern={party.event.coverPattern ?? "dots"} height={72} />}
                <div className="p-3">
                  <DateLine start={new Date(party.event.startsAt)} />
                  <p className="text-title font-semibold" data-testid="party-event-title">{party.event.title}</p>
                  <p className="text-meta text-muted">{party.event.venueName}</p>
                  {hangout && party.event.description && (
                    <p className="mt-1 flex items-start gap-1.5 text-meta text-muted">
                      <MapPinned size={14} className="mt-px shrink-0" aria-hidden /> {party.event.description}
                    </p>
                  )}
                </div>
              </Link>
            </Card>
          </Section>
        )}

        <div className="bg-surface">
          <TraceRow partyId={party.id} />
        </div>

        <Section>
          {party.chat ? (
            <ButtonLink href={`/chats/${party.chat.id}`} variant="primary" size="lg" block data-testid="open-squad-chat">
              Open squad chat
            </ButtonLink>
          ) : (
            <ButtonLink href={`/squad/${party.id}`} variant="primary" size="lg" block>
              See your squad
            </ButtonLink>
          )}
          <p className="mt-2 text-center text-meta text-muted">
            {others.length} {others.length === 1 ? "person" : "people"} will see your first name and what you have in common. Leave any time.
          </p>
        </Section>
      </Stack>
    </div>
  );
}

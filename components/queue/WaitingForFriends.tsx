"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, MapPinned } from "lucide-react";
import { Avatar, Button, IconCircle, ListRow, Section, Stack } from "@/components/fb";
import { TopBar } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";
import type { getGroupView } from "@/lib/server/queueGroups";

type View = NonNullable<Awaited<ReturnType<typeof getGroupView>>>;

const first = (n: string) => n.split(" ")[0];

const SEAT: Record<string, string> = {
  host: "Started this",
  invited: "Invited",
  in: "In",
  declined: "Can't make it",
  left: "Left",
  missed: "Didn't answer in time",
};

/**
 * Queue with friends, before queuing. The host sees who's in and starts queuing; an invited friend
 * sees the plan and says yes or no. Once the host starts, everyone who's in moves to the queue.
 */
export function WaitingForFriends({ initial, meId }: { initial: View; meId: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const v = await fetch(`/api/groups/${initial.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (v) setView(v);
  }, [initial.id]);

  useLiveEvents(["queueGroup"], refresh, refresh);
  useEffect(() => {
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const going = view.status === "queued" || view.status === "matched";
  const mine = view.mySeat === "host" || view.mySeat === "in";
  useEffect(() => {
    if (going && mine) router.replace("/queue");
  }, [going, mine, router]);

  const act = async (action: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/groups/${view.id}/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!j.ok) setError(j.error === "blocked" ? "You can't be in a squad with everyone in this group." : "That didn't work. Try again.");
    if (j.ok && (action === "cancel" || action === "leave" || (action === "respond" && !(body as { accept: boolean }).accept))) return router.push("/events");
    refresh();
  };

  const inCount = view.members.filter((m) => m.status === "in").length;
  const waitingOn = view.members.filter((m) => m.status === "invited").length;
  const title = view.mode === "hangout" ? "A new hangout" : view.event ? view.event.title : "Any event this weekend";
  const hostName = first(view.host.name);
  const newPeople = view.targetSize - 1 - view.members.filter((m) => m.status === "in" || m.status === "invited").length;

  return (
    <div data-testid="waiting-for-friends" data-status={view.status} data-seat={view.mySeat}>
      <TopBar back="/events" title={view.isHost ? "Waiting for your friends" : `${hostName}'s invite`} />
      <Stack>
        <Section>
          {!view.isHost && view.mySeat === "invited" && view.status === "gathering" && (
            <p className="mb-3 text-title font-semibold" data-testid="invite-heading">
              {hostName} wants to find a squad with you
            </p>
          )}
          <div className="flex items-center gap-3">
            <IconCircle tone="on">{view.mode === "hangout" ? <MapPinned size={18} /> : <CalendarDays size={18} />}</IconCircle>
            <span className="min-w-0">
              <span className="block truncate text-body font-semibold">{title}</span>
              <span className="block text-meta text-muted">
                Near {view.areaName} · squad of {view.targetSize}
              </span>
            </span>
          </div>
          <p className="mt-3 text-body text-muted">
            You&apos;ll stay together in one squad. Queue Up finds {Math.max(1, newPeople)} new {Math.max(1, newPeople) === 1 ? "person" : "people"} who fit all of you.
          </p>
        </Section>

        <Section flush title="Friends">
          <ul data-testid="friend-seats">
            {view.members.map((m) => (
              <li key={m.id}>
                <ListRow
                  testId={`seat-${m.id}`}
                  data={{ status: m.status }}
                  leading={<Avatar name={m.name} color={m.avatarColor} size={40} />}
                  title={m.id === meId ? `${m.name} (you)` : m.name}
                  subtitle={`${SEAT[m.status]}${m.isSimulated && m.id !== meId ? " · Sample person" : ""}`}
                />
              </li>
            ))}
          </ul>
        </Section>

        <Section>
          {error && (
            <p role="alert" className="mb-2 text-meta font-semibold text-badge">
              {error}
            </p>
          )}
          {view.status === "cancelled" && <p className="text-body text-muted">{hostName} cancelled this.</p>}
          {view.isHost && view.status === "gathering" && (
            <>
              <Button variant="primary" size="lg" block disabled={busy || inCount === 0} onClick={() => act("start")} data-testid="start-queuing">
                {inCount === 0 ? "Waiting for friends…" : "Start queuing"}
              </Button>
              <p className="mt-2 text-center text-meta text-muted">
                {waitingOn > 0 && inCount > 0 ? `Anyone who hasn't answered stays behind when you start.` : inCount === 0 ? "You can start once a friend is in." : "Everyone's in."}
              </p>
              <Button block className="mt-2" disabled={busy} onClick={() => act("cancel")} data-testid="cancel-group">
                Cancel
              </Button>
            </>
          )}
          {!view.isHost && view.status === "gathering" && view.mySeat === "invited" && (
            <>
              <Button variant="primary" size="lg" block disabled={busy} onClick={() => act("respond", { accept: true })} data-testid="accept-invite">
                Join
              </Button>
              <Button block className="mt-2" disabled={busy} onClick={() => act("respond", { accept: false })} data-testid="decline-invite">
                Not this time
              </Button>
              <p className="mt-2 text-center text-meta text-muted">{hostName} only sees that you can&apos;t make it, not why.</p>
            </>
          )}
          {!view.isHost && view.status === "gathering" && view.mySeat === "in" && (
            <>
              <p className="text-body" data-testid="waiting-for-host">You&apos;re in. {hostName} will start the queue.</p>
              <Button block className="mt-2" disabled={busy} onClick={() => act("leave")} data-testid="leave-group">
                Leave
              </Button>
            </>
          )}
          {view.mySeat === "missed" && <p className="text-body text-muted">{hostName} started queuing before you answered.</p>}
        </Section>
      </Stack>
    </div>
  );
}

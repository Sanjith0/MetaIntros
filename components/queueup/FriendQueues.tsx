"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, EyeOff } from "lucide-react";
import { AiLabel, Avatar, Button, ButtonLink, ListRow, Section } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import { DateLine } from "@/components/events/DateLine";
import type { FriendQueue } from "@/lib/server/friendQueues";

const first = (name: string) => name.split(" ")[0];
const minutes = (iso: string, nowMs: number) => Math.max(1, Math.round((nowMs - new Date(iso).getTime()) / 60_000));

/** Where the "why" line came from, in plain words (same wording as the match trace). */
const SOURCE: Record<string, string> = {
  live: "Written by AI just now",
  cache: "Saved AI response",
  mock: "Test model",
  fallback: "Template (AI unavailable)",
};

const CANT: Record<string, string> = {
  in_squad: "Their squad is already set, so this queue is closed.",
  women_only: "This is a women-only queue.",
  age_band: "Squads are matched within an age range, so you can't join this one.",
  blocked: "You can't join this queue.",
  full: "Their squad has no room left for friends.",
};

/**
 * Friends' queues: the friends who chose to share which queue they're in. `rail` = the Events tab row of
 * avatars; `list` = rows on an event page. Both open the same sheet with "Queue up too".
 */
export function FriendQueues({ queues, variant = "rail", nowMs, eventTitle }: { queues: FriendQueue[]; variant?: "rail" | "list"; nowMs: number; eventTitle?: string }) {
  const [open, setOpen] = useState<FriendQueue | null>(null);
  if (!queues.length) return null;

  return (
    <>
      {variant === "rail" ? (
        <Section title="Friends queuing" testId="friend-queues" className="scroll-mt-14" flush>
          <ul id="friends-queuing" className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-1">
            {queues.map((q) => (
              <li key={q.entryId} className="w-20 shrink-0">
                <button type="button" onClick={() => setOpen(q)} data-testid="friend-queue" data-friend={q.friend.id} className="press flex w-full flex-col items-center text-center">
                  <span className={q.state === "waiting" ? "rounded-full p-0.5 ring-2 ring-accent" : "rounded-full p-0.5 ring-2 ring-divider"}>
                    <Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />
                  </span>
                  <span className="mt-1 w-full truncate text-meta font-semibold">{first(q.friend.name)}</span>
                  <span className="w-full truncate text-[12px] leading-tight text-muted">{q.mode === "hangout" ? "New hangout" : q.event?.title ?? "Any event"}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Section title={eventTitle ? "Friends in this queue" : "Friends queuing"} testId="friend-queues-event" flush>
          <ul>
            {queues.map((q) => (
              <li key={q.entryId}>
                <ListRow
                  onClick={() => setOpen(q)}
                  testId="friend-queue"
                  data={{ friend: q.friend.id }}
                  leading={<Avatar name={q.friend.name} color={q.friend.avatarColor} size={44} />}
                  title={q.friend.name}
                  subtitle={`${q.state === "waiting" ? `In line for ${minutes(q.since, nowMs)} min` : "In a squad"} · near ${q.area}`}
                  trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <FriendQueueSheet q={open} onClose={() => setOpen(null)} nowMs={nowMs} />
    </>
  );
}

function FriendQueueSheet({ q, onClose, nowMs }: { q: FriendQueue | null; onClose: () => void; nowMs: number }) {
  const router = useRouter();
  const [why, setWhy] = useState<{ line: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWhy(null);
    setError(null);
    if (!q) return;
    let live = true;
    fetch(`/api/friends/queues/${q.entryId}/why`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j?.ok && setWhy({ line: j.line, source: j.source }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [q]);

  const join = async (separate = false) => {
    if (!q) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/friends/queues/${q.entryId}/join`, { method: "POST", body: JSON.stringify({ separate }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (j.ok) return router.push("/queue");
    setBusy(false);
    setError(j.error === "age" ? "Link is for people 18 and over." : j.error === "not_visible" ? `${q ? first(q.friend.name) : "They"} isn't sharing this queue anymore.` : "Couldn't join the queue. Try again.");
  };

  return (
    <Sheet open={!!q} onClose={onClose} title={q ? `${first(q.friend.name)} is ${q.state === "waiting" ? "queuing" : "in a squad"}` : ""} testId="friend-queue-sheet">
      {q && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-3">
            <Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />
            <div className="min-w-0">
              <p className="text-body font-semibold" data-testid="friend-queue-label">{q.friend.name}</p>
              <p className="text-body">{q.label}</p>
              <p className="text-meta text-muted">
                Near {q.area}
                {q.state === "waiting" ? ` · ${minutes(q.since, nowMs)} min in line` : ""} · Squads of {q.targetSize}
              </p>
              {q.state === "waiting" && (
                <p className="text-meta text-muted" data-testid="friend-queue-progress">
                  {q.found ? `${Math.min(q.found, q.targetSize)} of ${q.targetSize} found` : "Looking for matches"}
                  {q.together > 0
                    ? ` · with ${q.togetherFriends.length ? q.togetherFriends.join(", ") : ""}${q.togetherFriends.length && q.together > q.togetherFriends.length ? " and " : ""}${q.together > q.togetherFriends.length ? `${q.together - q.togetherFriends.length} other${q.together - q.togetherFriends.length > 1 ? "s" : ""}` : ""}`
                    : ""}
                </p>
              )}
            </div>
          </div>
          {q.event && (
            <Link href={`/events/${q.event.id}`} className="mt-3 block rounded-card bg-wash px-3 py-2" data-testid="friend-queue-event">
              <DateLine start={new Date(q.event.startsAt)} />
              <span className="block truncate text-body font-semibold">{q.event.title}</span>
            </Link>
          )}
          {why && (
            <div className="mt-3" data-testid="friend-queue-why">
              <p className="text-body">{why.line}</p>
              <AiLabel className="mt-0.5" testId="friend-queue-why-source">{SOURCE[why.source] ?? "Written by AI"}</AiLabel>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {q.canJoinTogether ? (
              <Button variant="primary" size="lg" block onClick={() => join(false)} disabled={busy} data-testid="join-friend-squad">
                {busy ? "Joining…" : `Join ${first(q.friend.name)}`}
              </Button>
            ) : q.canJoin ? (
              <Button variant="primary" size="lg" block onClick={() => join(true)} disabled={busy} data-testid="queue-up-too">
                {busy ? "Joining…" : "Queue up too"}
              </Button>
            ) : (
              <p className="rounded-card bg-wash p-3 text-meta text-muted" data-testid="friend-queue-closed">{CANT[q.cantJoinReason ?? ""] ?? "You can't join this queue."}</p>
            )}
            {q.canJoinTogether && q.canJoin && (
              <Button variant="secondary" block onClick={() => join(true)} disabled={busy} data-testid="queue-up-too">
                Queue separately
              </Button>
            )}
            {q.event && <ButtonLink href={`/events/${q.event.id}`} variant="secondary" block>View event</ButtonLink>}
          </div>
          {q.canJoinTogether ? (
            <p className="mt-2 text-meta text-muted" data-testid="join-together-note">
              You&apos;ll queue together with {first(q.friend.name)} and land in the same squad. Link fills the other spots.
            </p>
          ) : q.canJoin ? (
            <p className="mt-2 text-meta text-muted">
              You&apos;ll be in the same queue, near {q.area}. You might end up in the same squad, but it isn&apos;t guaranteed.
            </p>
          ) : null}
          {error && <p role="alert" className="mt-2 text-meta font-semibold text-badge">{error}</p>}
          <p className="mt-3 flex items-start gap-2 text-meta text-muted">
            <EyeOff size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>{first(q.friend.name)} chose to share this with friends. You only see the area, never who else is in line.</span>
          </p>
        </div>
      )}
    </Sheet>
  );
}

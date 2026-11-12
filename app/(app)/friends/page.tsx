import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FriendRequestActions } from "@/components/FriendRequestActions";
import { listFriends, listQueueUpFriends, listRequests } from "@/lib/server/friends";
import { getCurrentUserId } from "@/lib/server/session";

const TABS = [
  { id: "friends", label: "Your friends" },
  { id: "requests", label: "Requests" },
  { id: "queueup", label: "Met through Queue Up" },
] as const;

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "friends";
  const userId = await getCurrentUserId();
  const [friends, requests, queueUp] = await Promise.all([listFriends(userId), listRequests(userId), listQueueUpFriends(userId)]);
  const counts = { friends: friends.length, requests: requests.incoming.length, queueup: queueUp.length };

  return (
    <div data-testid="friends-page" className="min-h-[60dvh] bg-white px-4 pt-3">
      <h1 className="text-2xl font-bold">Friends</h1>
      <div className="mt-2 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <Link key={t.id} href={`/friends?tab=${t.id}`} role="tab" aria-selected={t.id === tab} data-testid={`friends-tab-${t.id}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${t.id === tab ? "bg-[#e7f3ff] text-fb-blue" : "bg-fb-bg"}`}>
            {t.label}
            {counts[t.id] > 0 && t.id !== "friends" && <span className="ml-1 rounded-full bg-[#e41e3f] px-1.5 text-xs text-white">{counts[t.id]}</span>}
          </Link>
        ))}
      </div>

      {tab === "friends" && (
        <ul className="mt-3 divide-y divide-fb-bg" data-testid="friends-list">
          <li className="pb-2 text-sm text-fb-muted">{friends.length} friends</li>
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2" data-testid="friend-row">
              <Avatar name={f.name} color={f.avatarColor} size={52} />
              <span>
                <span className="block font-semibold">{f.name}</span>
                <span className="block text-sm text-fb-muted">{f.mutual} mutual friends · {f.neighborhood}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {tab === "requests" && (
        <ul className="mt-3 space-y-3" data-testid="requests-list">
          {requests.incoming.length === 0 && requests.outgoing.length === 0 && <li className="py-8 text-center text-fb-muted">No pending requests</li>}
          {requests.incoming.map((r) => (
            <li key={r.id} className="flex items-center gap-3" data-testid="request-row">
              <Avatar name={r.from.name} color={r.from.avatarColor} size={64} />
              <span className="flex-1">
                <span className="block font-semibold">{r.from.name}</span>
                {r.partyId && <span className="block text-xs text-queue-glow">From your Queue Up squad</span>}
                <FriendRequestActions requestId={r.id} />
              </span>
            </li>
          ))}
          {requests.outgoing.map((r) => (
            <li key={r.id} className="flex items-center gap-3 opacity-80" data-testid="outgoing-request-row">
              <Avatar name={r.to.name} color={r.to.avatarColor} size={48} />
              <span className="flex-1">
                <span className="block font-semibold">{r.to.name}</span>
                <span className="block text-sm text-fb-muted">Request sent · waiting for them to accept</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {tab === "queueup" && (
        <ul className="mt-3 space-y-3" data-testid="queueup-list">
          {queueUp.length === 0 && (
            <li className="rounded-xl bg-fb-bg p-6 text-center text-fb-muted" data-testid="queueup-empty">
              <Sparkles className="mx-auto mb-2 text-queue-glow" />
              People you meet through a Queue Up squad will show up here.
            </li>
          )}
          {queueUp.map((q) => (
            <li key={q.id} className="flex items-center gap-3 rounded-xl border border-[#e9e3ff] bg-gradient-to-r from-[#f6f3ff] to-white p-3" data-testid="queueup-row">
              <Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />
              <span>
                <span className="block font-semibold">{q.friend.name}</span>
                {q.event && <span className="block text-sm text-fb-muted" data-testid="met-at">Met at {q.event.title}</span>}
                {q.sharedNote && <span className="block text-sm text-queue-glow" data-testid="shared-note">You both love {q.sharedNote}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

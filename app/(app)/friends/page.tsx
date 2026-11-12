import { UserPlus, Users } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, Badge, Button, ChipLink, ChipRow, IconCircle, ListRow, Section, Stack } from "@/components/fb";
import { FriendRequestActions } from "@/components/FriendRequestActions";
import { listFriends, listQueueUpFriends, listRequests, listSuggestions } from "@/lib/server/friends";
import { getCurrentUserId } from "@/lib/server/session";
import { listFriendQueues } from "@/lib/server/friendQueues";

const TABS = [
  { id: "friends", label: "Your friends" },
  { id: "requests", label: "Requests" },
  { id: "queueup", label: "Met through Queue Up" },
] as const;

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "friends";
  const userId = await getCurrentUserId();
  const [friends, requests, queueUp, suggestions, friendQueues] = await Promise.all([listFriends(userId), listRequests(userId), listQueueUpFriends(userId), listSuggestions(userId), listFriendQueues(userId)]);
  const queueOf = new Map(friendQueues.map((q) => [q.friend.id, q]));
  const counts = { friends: friends.length, requests: requests.incoming.length, queueup: queueUp.length };

  return (
    <div data-testid="friends-page">
      <TopBar title="Friends" />
      <Stack>
        <div className="bg-surface px-4 pt-1 pb-3">
          <ChipRow label="Friends sections">
            {TABS.map((t) => (
              <ChipLink key={t.id} href={`/friends?tab=${t.id}`} on={t.id === tab} data-testid={`friends-tab-${t.id}`} scroll={false}>
                {t.label}
                {counts[t.id] > 0 && t.id !== "friends" && <Badge count={counts[t.id]} className="ml-0.5 ring-0" />}
              </ChipLink>
            ))}
          </ChipRow>
        </div>

        {tab === "friends" && suggestions.length > 0 && (
          <Section title="People you may know" testId="suggestions">
            <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {suggestions.map((s) => (
                <li key={s.id} className="w-36 shrink-0 overflow-hidden rounded-card bg-surface shadow-card" data-testid="suggestion">
                  <div className="flex justify-center bg-wash py-4">
                    <Avatar name={s.user.name} color={s.user.avatarColor} size={72} />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-body font-semibold">{s.user.name}</p>
                    <p className="truncate text-meta text-muted">{s.squadmate ? "From your squad" : `${s.mutual} mutual friends`}</p>
                    <Button variant="on" size="sm" block className="mt-2" icon={<UserPlus size={14} />}>Add friend</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {tab === "friends" && (
          <Section flush title={`${friends.length} friends`} className="pb-4">
            <ul data-testid="friends-list">
              {friends.map((f) => (
                <li key={f.id} data-testid="friend-row">
                  <ListRow
                    leading={<Avatar name={f.name} color={f.avatarColor} size={56} />}
                    title={f.name}
                    href={queueOf.get(f.id) ? "/events#friends-queuing" : undefined}
                    subtitle={
                      queueOf.get(f.id) ? (
                        <span className="font-semibold text-link" data-testid="friend-queue-status">{queueOf.get(f.id)!.label}</span>
                      ) : (
                        `${f.mutual} mutual friends${f.neighborhood ? ` · ${f.neighborhood}` : ""}`
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {tab === "requests" && (
          <Section flush title="Friend requests" className="pb-4">
            <ul data-testid="requests-list">
              {requests.incoming.length === 0 && requests.outgoing.length === 0 && <li className="px-4 py-8 text-center text-muted">No pending requests</li>}
              {requests.incoming.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-4 py-2" data-testid="request-row">
                  <Avatar name={r.from.name} color={r.from.avatarColor} size={72} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold">{r.from.name}</span>
                    {r.partyId && <span className="block text-meta text-muted">From your Queue Up squad</span>}
                    <FriendRequestActions requestId={r.id} />
                  </span>
                </li>
              ))}
              {requests.outgoing.map((r) => (
                <li key={r.id} data-testid="outgoing-request-row">
                  <ListRow leading={<Avatar name={r.to.name} color={r.to.avatarColor} size={56} />} title={r.to.name} subtitle="Request sent" />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {tab === "queueup" && (
          <Section flush title="Met through Queue Up" className="pb-4">
            <ul data-testid="queueup-list">
              {queueUp.length === 0 && (
                <li className="flex flex-col items-center px-6 py-8 text-center text-muted" data-testid="queueup-empty">
                  <IconCircle size={48}><Users size={22} /></IconCircle>
                  <span className="mt-2">People you meet through a squad and both add will show up here.</span>
                </li>
              )}
              {queueUp.map((q) => (
                <li key={q.id} data-testid="queueup-row">
                  <ListRow
                    leading={<Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />}
                    title={q.friend.name}
                    subtitle={q.event ? <span data-testid="met-at">Met through Queue Up · {q.event.title}</span> : "Met through Queue Up"}
                    meta={q.sharedNote ? <span data-testid="shared-note">You both love {q.sharedNote}</span> : undefined}
                  />
                </li>
              ))}
            </ul>
          </Section>
        )}
      </Stack>
    </div>
  );
}

import { Users } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, Badge, FacePile, ListRow } from "@/components/fb";
import { listInbox } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { fmtDuration, timeAgo } from "@/lib/format";
import { now as clockNow } from "@/lib/server/clock";
import { sweepExpiredChats } from "@/lib/server/expiry";

/** Chats (behind the top bar's Messages button): Messenger-style rows, active squad chats pinned on top. */
export default async function ChatsPage() {
  const userId = await getCurrentUserId();
  await sweepExpiredChats();
  const [rows, now] = await Promise.all([listInbox(userId), clockNow()]);
  return (
    <div data-testid="chats-page" className="min-h-[70dvh] bg-surface">
      <TopBar back="/home" title="Chats" />
      <ul data-testid="inbox" className="pt-1">
        {rows.map((r) => {
          const squad = r.type === "squad";
          const others = r.members.filter((m) => m.id !== userId);
          const snippet = `${r.lastSender ? `${r.lastSender}: ` : ""}${r.lastMessage ?? "Say hi"} · ${timeAgo(r.lastMessageAt, now)}`;
          return (
            <li key={r.id}>
              <ListRow
                href={`/chats/${r.id}`}
                testId={`inbox-row-${r.id}`}
                data={{ type: r.type }}
                bold={r.unread > 0}
                leading={
                  <span className="relative">
                    {squad ? <FacePile people={others.slice(0, 2)} size={40} max={2} /> : <Avatar name={r.avatar.name} color={r.avatar.color} size={56} character={r.type === "direct"} />}
                    {squad && (
                      <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-surface ring-2 ring-surface" aria-hidden>
                        <Users size={11} />
                      </span>
                    )}
                  </span>
                }
                title={
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{r.title}</span>
                    {squad && <span data-testid="squad-badge" className="shrink-0 text-meta font-normal text-muted">· Squad</span>}
                  </span>
                }
                subtitle={<span className="block truncate">{snippet}</span>}
                meta={
                  squad && r.expiresAt ? (
                    <span data-testid="squad-expiry">
                      {r.event && !r.archived && <span data-testid="squad-event">{r.event.title} · </span>}
                      {r.archived ? "Chat ended" : `ends in ${fmtDuration(r.expiresAt.getTime() - now.getTime())}`}
                    </span>
                  ) : undefined
                }
                trailing={r.unread > 0 ? <Badge count={r.unread} tone="blue" testId="unread-count" /> : null}
              />
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-10 text-center text-muted">No chats yet.</li>}
      </ul>
    </div>
  );
}

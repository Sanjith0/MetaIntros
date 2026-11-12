import Link from "next/link";
import { Archive, Clock, Swords } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { listInbox } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { fmtDuration, timeAgo } from "@/lib/format";
import { now as clockNow } from "@/lib/server/clock";

export default async function ChatsPage() {
  const userId = await getCurrentUserId();
  const [rows, now] = await Promise.all([listInbox(userId), clockNow()]);
  return (
    <div data-testid="chats-page" className="bg-white">
      <h1 className="px-4 pt-3 text-2xl font-bold">Chats</h1>
      <ul data-testid="inbox">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/chats/${r.id}`} data-testid={`inbox-row-${r.id}`} data-type={r.type} className={`flex items-center gap-3 px-4 py-2.5 active:bg-fb-bg ${r.type === "squad" && !r.archived ? "bg-gradient-to-r from-[#f3efff] to-white" : ""}`}>
              <span className="relative">
                <Avatar name={r.avatar.name} color={r.avatar.color} size={56} />
                {r.type === "squad" && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-queue-glow text-white ring-2 ring-white">
                    <Swords size={13} />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {r.type === "squad" && (
                    <span data-testid="squad-badge" className="rounded bg-queue-glow px-1.5 py-px text-[10px] font-bold uppercase text-white">Squad</span>
                  )}
                  <span className={`truncate ${r.unread ? "font-bold" : "font-medium"}`}>{r.title}</span>
                </span>
                {r.type === "squad" && r.event && (
                  <span className="block truncate text-xs text-queue-glow" data-testid="squad-event">{r.event.title}</span>
                )}
                <span className={`block truncate text-sm ${r.unread ? "font-semibold text-fb-text" : "text-fb-muted"}`}>
                  {r.lastSender ? `${r.lastSender}: ` : ""}
                  {r.lastMessage ?? "Say hi 👋"} · {timeAgo(r.lastMessageAt, now)}
                </span>
                {r.type === "squad" && r.expiresAt && (
                  <span className="flex items-center gap-1 text-[11px] text-fb-muted" data-testid="squad-expiry">
                    {r.archived ? <><Archive size={11} /> Archived</> : <><Clock size={11} /> Expires in {fmtDuration(r.expiresAt.getTime() - now.getTime())} (24h after the event)</>}
                  </span>
                )}
              </span>
              {r.unread > 0 && (
                <span data-testid="unread-count" className="min-w-[20px] rounded-full bg-fb-blue px-1.5 text-center text-xs font-bold leading-5 text-white">{r.unread}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

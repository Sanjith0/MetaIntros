import Link from "next/link";
import { Bell, CalendarDays, MessageCircleOff, UserPlus, Users } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, Badge, cn } from "@/components/fb";
import { getCurrentUserId } from "@/lib/server/session";
import { listNotifications, type NotificationKind } from "@/lib/server/notifications";
import { getTabSeen } from "@/lib/server/badges";
import { now as clockNow } from "@/lib/server/clock";
import { timeAgo } from "@/lib/format";

const KIND: Record<NotificationKind, { Icon: typeof Bell; tone: string }> = {
  squad: { Icon: Users, tone: "bg-accent" },
  chat_ended: { Icon: MessageCircleOff, tone: "bg-muted" },
  request: { Icon: UserPlus, tone: "bg-accent" },
  met: { Icon: Users, tone: "bg-positive" },
  reminder: { Icon: CalendarDays, tone: "bg-date" },
  friend_queue: { Icon: Users, tone: "bg-accent" },
  group_invite: { Icon: UserPlus, tone: "bg-accent" },
};

/**
 * Notifications, built from what Queue Up already stores. Seen state is read before this visit marks
 * the tab seen, so new rows stay highlighted for this view.
 */
export default async function NotificationsPage() {
  const userId = await getCurrentUserId();
  const [items, seen, now] = await Promise.all([clockNow().then((n) => listNotifications(userId, n)), getTabSeen(userId, "notifications"), clockNow()]);
  const fresh = items.filter((n) => n.at > seen && n.kind !== "reminder");
  const earlier = items.filter((n) => !(n.at > seen && n.kind !== "reminder"));
  const Row = ({ n, unread }: { n: (typeof items)[number]; unread: boolean }) => {
    const { Icon, tone } = KIND[n.kind];
    return (
      <li>
        <Link href={n.href} data-testid={`notif-${n.kind}`} className={cn("flex items-start gap-3 px-4 py-2.5 hover:bg-press", unread && "bg-unread")}>
          <span className="relative shrink-0">
            <Avatar name={n.avatar.name} color={n.avatar.color} size={56} />
            <span className={cn("absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full text-surface ring-2 ring-surface", tone)} aria-hidden>
              <Icon size={13} />
            </span>
          </span>
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block text-body">
              <span className="font-semibold">{n.bold}</span> {n.text}
            </span>
            <span className={cn("text-meta", unread ? "font-semibold text-link" : "text-muted")}>{timeAgo(n.at, now)}</span>
          </span>
          {unread && <Badge dot className="mt-5" />}
        </Link>
      </li>
    );
  };
  return (
    <div data-testid="notifications-page" className="min-h-[70dvh] bg-surface">
      <TopBar title="Notifications" />
      {fresh.length > 0 && (
        <>
          <h2 className="px-4 pt-3 pb-1 text-title font-semibold">New</h2>
          <ul>{fresh.map((n) => <Row key={n.id} n={n} unread />)}</ul>
        </>
      )}
      {(earlier.length > 0 || items.length === 0) && <h2 className="px-4 pt-3 pb-1 text-title font-semibold">Earlier</h2>}
      <ul>
        {earlier.map((n) => <Row key={n.id} n={n} unread={false} />)}
        {items.length === 0 && <li className="px-4 py-10 text-center text-muted">You&apos;re all caught up.</li>}
      </ul>
    </div>
  );
}

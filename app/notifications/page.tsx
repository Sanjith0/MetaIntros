import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconSparkle } from "@/components/icons";
import { flag } from "@/lib/flags";
import { timeAgo } from "@/lib/format";
import { markSeen, notificationsFor } from "@/lib/server/notifications";
import { currentViewerId } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/** F58: your Party Queue notifications, kept. Opening this marks them seen. */
export default async function NotificationsPage() {
  if (!flag("NOTIFICATIONS_LIST")) notFound();
  const viewer = await currentViewerId();
  const list = notificationsFor(viewer);
  markSeen(viewer);
  return (
    <main className="mx-auto max-w-[680px] px-4 py-5" data-testid="notifications">
      <h1 className="text-[24px] font-bold">Notifications</h1>
      <p className="text-[14px] text-[var(--color-ink-2)]">Party Queue updates sent only to you. Chat messages stay in the chat.</p>
      {list.length === 0 ? (
        <p className="mt-4 rounded-[12px] bg-white p-4 text-[15px] text-[var(--color-ink-2)] shadow-[var(--shadow-card)]">Nothing yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-divider)] overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-card)]">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="flex gap-3 px-4 py-3 hover:bg-black/5" data-testid="notification">
                <IconSparkle size={20} className="mt-0.5 shrink-0 text-[var(--color-pq)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{n.text}</span>
                  <span className="text-[12px] text-[var(--color-ink-2)]">{timeAgo(n.at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

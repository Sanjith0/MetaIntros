import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, FacePile } from "@/components/Avatar";
import { ChatThread } from "@/components/chat/ChatThread";
import { IconSparkle } from "@/components/icons";
import { timeAgo } from "@/lib/format";
import { chatsFor, chatView } from "@/lib/server/social";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Chats" };
export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await currentViewerId();
  const view = chatView(id, viewer);
  if (!view) notFound();
  const list = chatsFor(viewer);
  const s = store();
  const people = Object.fromEntries([...s.profiles.values()].map((p) => [p.id, { name: p.name, firstName: p.firstName, hue: p.avatarHue }]));

  return (
    <main className="flex h-[calc(100dvh-79px)] bg-white sm:h-[calc(100dvh-56px)]" data-testid="chat-page">
      {/* Sidebar */}
      <aside className="hidden w-[360px] shrink-0 flex-col border-r border-[var(--color-divider)] md:flex">
        <h1 className="px-4 pb-2 pt-3 text-[24px] font-bold">Chats</h1>
        <ul className="flex-1 overflow-y-auto px-2">
          {list.map(({ chat, last }) => (
            <li key={chat.id}>
              <Link href={`/chat/${chat.id}`} className={`flex items-center gap-3 rounded-[8px] p-2 hover:bg-black/5 ${chat.id === id ? "bg-[var(--color-on-bg)]" : ""}`}>
                <FacePile people={chat.memberIds.filter((m) => m !== viewer).slice(0, 2).map((m) => ({ id: m, ...people[m]! }))} size={36} max={2} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-[15px] font-medium">
                    {chat.partyId && <IconSparkle size={14} className="shrink-0 text-[var(--color-pq)]" />}
                    {chat.title}
                  </span>
                  <span className="block truncate text-[13px] text-[var(--color-ink-2)]">
                    {last ? `${last.senderId ? `${people[last.senderId]?.firstName}: ` : ""}${last.text}` : "No messages yet"}
                    {last ? ` · ${timeAgo(last.at)}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-divider)] px-4 shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
          <FacePile people={view.members.filter((m) => m.id !== viewer).slice(0, 2).map((m) => ({ id: m.id, name: m.name, hue: m.hue }))} size={36} max={2} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold" data-testid="chat-title">
              {view.chat.title}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-ink-2)]">
              {view.members.length} members
              {view.chat.partyId && <span className="rounded bg-[var(--color-pq-soft)] px-1.5 py-0.5 text-[11px] font-semibold uppercase text-[var(--color-pq)]">Party Queue</span>}
            </div>
          </div>
          <div className="hidden -space-x-2 sm:flex">
            {view.members.map((m) => (
              <Avatar key={m.id} name={m.name} hue={m.hue} size={24} ring />
            ))}
          </div>
        </header>
        <ChatThread key={`${id}-${viewer}`} chatId={id} viewerId={viewer} initial={view.messages} pinned={view.pinned} people={people} />
      </section>
    </main>
  );
}

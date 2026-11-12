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
import { flag } from "@/lib/flags";
import { explainSources } from "@/lib/server/provenance";
import { autoForgetDue } from "@/lib/server/forget";

function closesLabel(iso: string): string {
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // Shown in Pacific time, where the demo night happens.
  const pt = new Date(d.getTime() - 8 * 3600_000);
  const h = pt.getUTCHours();
  return `${days[pt.getUTCDay()]} ${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
}

export const metadata: Metadata = { title: "Chats" };
export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  autoForgetDue(); // F43
  const { id } = await params;
  const viewer = await currentViewerId();
  const view = chatView(id, viewer);
  if (!view) notFound();
  const list = chatsFor(viewer);
  const party = view.chat.partyId ? store().parties.get(view.chat.partyId) : undefined;
  const canPing = flag("CHAT_LIFECYCLE") && party?.status === "locked" && !(store().arrivals.get(party.id)?.has(viewer) ?? false);
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
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--color-ink-2)]">
              <span className="whitespace-nowrap">{view.members.length} members</span>
              {view.chat.expiresAt && !view.expired && (
                <span className="whitespace-nowrap" data-testid="chat-expiry">
                  · closes {closesLabel(view.chat.expiresAt)}
                </span>
              )}
              {view.chat.partyId && <span className="hidden whitespace-nowrap rounded bg-[var(--color-pq-soft)] px-1.5 py-0.5 text-[11px] font-semibold uppercase text-[var(--color-pq)] sm:inline">Party Queue</span>}
            </div>
          </div>
          <div className="hidden -space-x-2 sm:flex">
            {view.members.map((m) => (
              <Avatar key={m.id} name={m.name} hue={m.hue} size={24} ring />
            ))}
          </div>
        </header>
        {view.expired ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-white p-8 text-center" data-testid="chat-expired">
            <div className="text-[17px] font-semibold">This chat closed after the event</div>
            <p className="max-w-[360px] text-[14px] text-[var(--color-ink-2)]">Party chats close 12 hours after the night ends, and their messages are deleted. If you'd like to see someone again, say so privately in Run it back.</p>
            <Link href="/runitback" className="press mt-2 rounded-[6px] bg-[var(--color-pq)] px-4 py-2 text-[15px] font-semibold text-white">
              Run it back
            </Link>
          </div>
        ) : (
          <ChatThread
            key={`${id}-${viewer}`}
            chatId={id}
            viewerId={viewer}
            initial={view.messages}
            pinned={view.pinned}
            people={people}
            hereFor={canPing ? view.chat.partyId : null}
            retry={flag("UX_STATES")}
            why={
              flag("CHAT_WHY") && view.chat.partyId
                ? Object.fromEntries(
                    view.messages.filter((m) => (m.kind === "opener" || m.kind === "pinned") && m.sourceIds.length).map((m) => [m.id, explainSources(m.sourceIds, viewer, view.chat.partyId!)]),
                  )
                : {}
            }
          />
        )}
      </section>
    </main>
  );
}

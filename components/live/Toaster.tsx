"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PayloadOf } from "@/contracts";
import { Avatar } from "@/components/Avatar";
import { IconClose, IconSparkle } from "@/components/icons";
import { useLive, useLiveEvents } from "./LiveProvider";
import { playChime, vibrate } from "./sound";

export type Directory = Record<string, { name: string; firstName: string; hue: number }>;

interface Toast {
  id: string;
  title: string;
  body: string;
  href?: string;
  who?: string;
  layer?: boolean;
}

/** Notification toasts (bottom-left, as in the reference) plus the
 *  MATCH FOUND sheet, which is our layer and plays a chime. */
export function Toaster({ people, keyboard = true }: { people: Directory; keyboard?: boolean }) {
  const { viewerId, serverNow } = useLive();
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [match, setMatch] = useState<(PayloadOf<"match.found"> & { shownAt: number; sound: string; vibrate: string }) | null>(null);

  const push = (t: Toast) => {
    setToasts((xs) => [...xs.filter((x) => x.id !== t.id), t].slice(-4));
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 7000);
  };

  useLiveEvents((e) => {
    // The projector never shows a member's notifications; the glasses show only their own heads-up card.
    if (pathname?.startsWith("/stage") || pathname?.startsWith("/door/glasses")) return;
    switch (e.type) {
      case "match.found": {
        const shownAt = serverNow(); // server clock, so phones with drifting clocks still report true lag
        const buzz = vibrate();
        const payload = e.payload;
        setMatch({ ...payload, shownAt, sound: "pending", vibrate: buzz });
        playChime().then((sound) => {
          setMatch((m) => (m ? { ...m, sound } : m));
          fetch("/api/phones/ack", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ partyId: payload.partyId, shownAt, sound, vibrate: buzz }),
          }).catch(() => {});
        });
        router.refresh();
        break;
      }
      case "queue.invite": {
        const from = people[e.payload.fromId];
        const group = e.payload.groupOf;
        push({
          id: e.id,
          title: "Party Queue",
          body: group
            ? `${from?.firstName ?? "Someone"} wants your standing party to queue again. You'd all be in one party, with new people.`
            : `${from?.firstName ?? "A friend"} wants to queue with you. You'd be in the same party.`,
          href: group ? `/queue?event=${e.payload.eventId}&group=${group}` : `/queue?event=${e.payload.eventId}&duo=${e.payload.fromId}`,
          layer: true,
          who: e.payload.fromId,
        });
        break;
      }
      case "party.dissolved":
        push({ id: e.id, title: "Party Queue", body: "Your party changed before the plan was set. Nobody was named. You're back at the front of the queue.", href: "/queue", layer: true });
        router.refresh();
        break;
      case "party.nomatch":
        push({ id: e.id, title: "Party Queue", body: "No plan fit all five of you. Nobody was told why. Open your party for what's next.", href: "/party", layer: true });
        router.refresh();
        break;
      case "party.forming":
        push({ id: e.id, title: "Party Queue", body: "Your party of five is forming. Your agents are talking it over.", href: "/party", layer: true });
        break;
      case "chat.message": {
        const m = e.payload;
        if (m.senderId === viewerId || pathname === `/chat/${m.chatId}`) return;
        if (m.kind !== "user") return; // seeded and system lines arrive with MATCH FOUND
        const who = m.senderId ? people[m.senderId] : undefined;
        push({ id: e.id, title: who?.name ?? "Chat", body: m.text, href: `/chat/${m.chatId}`, who: m.senderId ?? undefined });
        break;
      }
      case "member.spotted": {
        const s = e.payload;
        if (!s.subjectId || pathname?.startsWith("/door")) return; // the door card already shows it
        push({ id: e.id, title: "At the door", body: `${people[s.subjectId]?.firstName ?? "Someone"} from your party is here.`, href: "/door", layer: true, who: s.subjectId });
        break;
      }
      case "member.arrived":
        if (e.payload.userId === viewerId || pathname?.startsWith("/chat")) return; // the chat shows the ping itself
        push({ id: e.id, title: "Party Queue", body: `${people[e.payload.userId]?.firstName ?? "Someone"} just arrived.`, href: "/door", layer: true, who: e.payload.userId });
        break;
      case "runitback.mutual": {
        if (pathname?.startsWith("/runitback")) return; // the page reveals it itself
        const other = e.payload.a === viewerId ? e.payload.b : e.payload.a;
        push({ id: e.id, title: "Run it back", body: `You and ${people[other]?.firstName ?? "someone"} both said yes.`, href: "/runitback", layer: true, who: other });
        break;
      }
    }
  });

  const primary = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!match || !keyboard) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMatch(null);
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => setMatch(null), 20_000);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [match?.partyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="pointer-events-none fixed left-4 top-[88px] z-50 flex w-[328px] max-w-[calc(100vw-32px)] flex-col gap-2 sm:bottom-4 sm:top-auto" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid="toast"
            className={`toast-in pointer-events-auto flex items-start gap-3 rounded-[8px] bg-white px-[10px] py-4 text-[var(--color-toast-ink)] shadow-[var(--shadow-elevated)] ${t.layer ? "border-l-4 border-[var(--color-pq)]" : ""}`}
          >
            {t.who && people[t.who] ? <Avatar name={people[t.who]!.name} hue={people[t.who]!.hue} size={40} /> : <span className="mt-0.5 text-[var(--color-pq)]"><IconSparkle /></span>}
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{t.title}</div>
              <div className="line-clamp-3 text-[13px] text-[var(--color-ink-2)]">{t.body}</div>
              {t.href && (
                <Link href={t.href} className="text-[13px] font-semibold text-[#216fdb] hover:underline">
                  Open
                </Link>
              )}
            </div>
            <button aria-label="Dismiss" className="text-[var(--color-ink-2)]" onClick={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}>
              <IconClose size={16} />
            </button>
          </div>
        ))}
      </div>

      {match && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Match found" onClick={(e) => e.target === e.currentTarget && setMatch(null)}>
          <div
            data-testid="match-found"
            data-party-id={match.partyId}
            data-locked-at={match.lockedAt}
            data-shown-at={match.shownAt}
            data-sound={match.sound}
            data-vibrate={match.vibrate}
            className="match-pop w-full max-w-[420px] overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-elevated)]"
          >
            <div className="bg-gradient-to-br from-[var(--color-pq)] to-[var(--color-pq-2)] px-6 pb-5 pt-6 text-white">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">
                <IconSparkle size={16} /> Party Queue
              </div>
              <div className="mt-2 text-[34px] font-extrabold leading-none tracking-tight">MATCH FOUND</div>
              <div className="mt-3 text-[15px] text-white/90">Your party of five agreed on a plan.</div>
            </div>
            <div className="px-6 py-5">
              <div className="text-[13px] font-semibold uppercase text-[var(--color-date)]">Sat, Nov 14 · {match.start}</div>
              <div className="text-[20px] font-bold">{match.title}</div>
              <div className="text-[15px] text-[var(--color-ink-2)]">{match.venueName}</div>
              <div className="mt-5 flex gap-2">
                <Link ref={primary} href={`/chat/${match.chatId}`} onClick={() => setMatch(null)} className="press flex-1 rounded-[6px] bg-[var(--color-pq)] px-4 py-2 text-center text-[15px] font-semibold text-white hover:opacity-90">
                  Open group chat
                </Link>
                <Link href="/party" onClick={() => setMatch(null)} className="press flex-1 rounded-[6px] bg-[var(--color-btn-2)] px-4 py-2 text-center text-[15px] font-semibold hover:bg-[var(--color-btn-2-hover)]">
                  See your party
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

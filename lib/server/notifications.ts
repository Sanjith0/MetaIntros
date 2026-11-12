import type { PQEvent } from "@/contracts";
import { flag } from "@/lib/flags";
import { visibleTo } from "./bus";
import { profile, store } from "./store";

/**
 * Notifications, kept (F58). Toasts vanish; if your phone was off when
 * MATCH FOUND, a plan B switch or a seat refill arrived, this is where you
 * find it. Built from the events only you were sent (the same audience
 * check as the live stream), in the same words as the toasts. Chat
 * messages stay in the chat.
 */
export interface Notification {
  id: string;
  seq: number;
  at: string;
  text: string;
  href: string;
}

const first = (id: string) => store().profiles.get(id)?.firstName ?? "Someone";

function describe(e: PQEvent, viewerId: string): { text: string; href: string } | null {
  switch (e.type) {
    case "match.found":
      return { text: `MATCH FOUND: ${e.payload.title}, ${e.payload.start} · ${e.payload.venueName}.`, href: "/party" };
    case "queue.invite": {
      const g = e.payload.groupOf;
      return {
        text: g
          ? g.startsWith("grp-")
            ? `${first(e.payload.fromId)} wants to queue with you as a group. You'd all be in one party, with new people.`
            : `${first(e.payload.fromId)} wants your standing party to queue again. You'd all be in one party, with new people.`
          : `${first(e.payload.fromId)} wants to queue with you. You'd be in the same party.`,
        href: g ? `/queue?event=${e.payload.eventId}&group=${g}` : `/queue?event=${e.payload.eventId}&duo=${e.payload.fromId}`,
      };
    }
    case "party.forming":
      return { text: "Your party of five is forming. Your agents are talking it over.", href: "/party" };
    case "party.dissolved":
      return { text: "Your party changed before the plan was set. Nobody was named. You're back at the front of the queue.", href: "/queue" };
    case "party.nomatch":
      return { text: "No plan fit all five of you. Nobody was told why.", href: "/party" };
    case "party.seat":
      return { text: e.payload.refilled ? "One person couldn't make it. Someone new is taking the seat." : "One person can't make it. The plan stands.", href: "/party" };
    case "party.switched":
      return { text: "Your party switched to plan B. Your RSVP moved.", href: "/party" };
    case "runitback.mutual": {
      const other = e.payload.a === viewerId ? e.payload.b : e.payload.a;
      return { text: `Run it back: you and ${first(other)} both said yes.`, href: "/runitback" };
    }
    default:
      return null;
  }
}

export function notificationsFor(viewerId: string): Notification[] {
  if (!flag("NOTIFICATIONS_LIST")) return [];
  profile(viewerId);
  return store()
    .events_log.filter((e) => e.audience.kind === "users" && visibleTo(e, { userId: viewerId }))
    .map((e) => {
      const d = describe(e, viewerId);
      return d ? { id: e.id, seq: e.seq, at: e.at, ...d } : null;
    })
    .filter((n): n is Notification => n !== null)
    .reverse();
}

export function unreadCount(viewerId: string): number {
  const seen = store().notifSeen.get(viewerId) ?? -1;
  return notificationsFor(viewerId).filter((n) => n.seq > seen).length;
}

export function markSeen(viewerId: string) {
  const top = notificationsFor(viewerId)[0];
  if (top) store().notifSeen.set(viewerId, top.seq);
}

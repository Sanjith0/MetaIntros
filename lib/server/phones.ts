import os from "node:os";
import { store } from "./store";

/**
 * Real phones on the local network. Presence counts open live connections
 * per person (kept outside the store so a demo reset does not forget the
 * phones that are still connected). Acks record when each phone actually
 * showed MATCH FOUND, in server time.
 */

const g = globalThis as unknown as { __pqPresence?: Map<string, number> };
const presence = () => (g.__pqPresence ??= new Map());

export function connect(userId: string): () => void {
  const p = presence();
  p.set(userId, (p.get(userId) ?? 0) + 1);
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const n = (p.get(userId) ?? 1) - 1;
    if (n <= 0) p.delete(userId);
    else p.set(userId, n);
  };
}

/** Operator screens (the projector) are counted apart from phones. */
const gs = globalThis as unknown as { __pqScreens?: Map<string, number> };
const screens = () => (gs.__pqScreens ??= new Map());
export function connectScreen(kind: "stage"): () => void {
  screens().set(kind, (screens().get(kind) ?? 0) + 1);
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    screens().set(kind, Math.max(0, (screens().get(kind) ?? 1) - 1));
  };
}
export const screensConnected = (kind: "stage") => screens().get(kind) ?? 0;

export function connected(userId: string): boolean {
  return (presence().get(userId) ?? 0) > 0;
}

export interface Ack {
  userId: string;
  partyId: string;
  shownAt: number; // server-clock ms
  lagMs: number; // shownAt - lockedAt
  sound: string;
  vibrate: string;
}

export function recordAck(input: { userId: string; partyId: string; shownAt: number; sound: string; vibrate: string }): Ack | null {
  const s = store();
  const party = s.parties.get(input.partyId);
  if (!party || !party.memberIds.includes(input.userId) || !party.lockedAt) return null;
  const ack: Ack = { ...input, lagMs: Math.max(0, Math.round(input.shownAt - Date.parse(party.lockedAt))) };
  s.acks = s.acks.filter((a) => !(a.partyId === input.partyId && a.userId === input.userId));
  s.acks.push(ack);
  return ack;
}

export function acksFor(partyId: string): Ack[] {
  return store().acks.filter((a) => a.partyId === partyId);
}

/** The first private IPv4 address of this machine, for QR links on the same Wi-Fi. */
export function lanAddress(ifaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()): string | null {
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) {
      if (i.family !== "IPv4" || i.internal) continue;
      if (i.address.startsWith("169.254.")) continue; // link-local
      candidates.push(i.address);
    }
  }
  const privateFirst = candidates.sort((a, b) => Number(!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) - Number(!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(b)));
  return privateFirst[0] ?? null;
}

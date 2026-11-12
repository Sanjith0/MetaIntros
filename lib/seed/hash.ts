import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TABLES = [
  "user", "tasteProfile", "availability", "friendship", "friendRequest", "block", "landmark", "event",
  "eventRsvp", "queueEntry", "party", "partyMember", "chat", "chatMember", "chatMessage", "talkCard",
  "preChat", "agentTrace", "deviceSession", "appSetting",
] as const;

const VOLATILE = new Set(["createdAt", "updatedAt"]);

/** Stable hash of DB contents (ignores auto timestamps). Used to prove seeding is idempotent. */
export async function contentHash(prisma: PrismaClient): Promise<{ hash: string; counts: Record<string, number> }> {
  const h = createHash("sha256");
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[t];
    const rows: Record<string, unknown>[] = await delegate.findMany({ orderBy: t === "appSetting" ? { key: "asc" } : { id: "asc" } });
    counts[t] = rows.length;
    h.update(t);
    h.update(JSON.stringify(rows, (k, v) => (VOLATILE.has(k) ? undefined : v)));
  }
  return { hash: h.digest("hex"), counts };
}

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { ChatMessage } from "./types";

/**
 * On-disk response cache (committed under data/ai-cache) so the demo path runs with no
 * network and no spend. Key = task + model-agnostic hash of the prompt.
 */
const DIR = path.join(process.cwd(), "data", "ai-cache");

export function cacheKey(task: string, messages: ChatMessage[]): string {
  const h = createHash("sha256").update(task).update(JSON.stringify(messages)).digest("hex").slice(0, 24);
  return `${task}-${h}`;
}

export function cacheGet(key: string): string | null {
  const f = path.join(DIR, `${key}.json`);
  if (!existsSync(f)) return null;
  try {
    return (JSON.parse(readFileSync(f, "utf8")) as { text: string }).text;
  } catch {
    return null;
  }
}

export function cachePut(key: string, text: string, meta: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test") return;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path.join(DIR, `${key}.json`), JSON.stringify({ text, ...meta, savedAt: new Date().toISOString() }, null, 2));
}

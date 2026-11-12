import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for realtime (SSE). One Node process serves the whole demo, so an
 * EventEmitter is enough; swap for Redis pub/sub if this ever runs on multiple instances.
 */
export interface BusMessage {
  topic: string;
  data: unknown;
  /** If set, only these users receive it. */
  userIds?: string[];
}

const g = globalThis as unknown as { __quBus?: EventEmitter };
const bus = g.__quBus ?? (g.__quBus = new EventEmitter().setMaxListeners(0));

export function publish(topic: string, data: unknown = {}, userIds?: string[]) {
  bus.emit("msg", { topic, data, userIds } satisfies BusMessage);
}

export function subscribe(fn: (m: BusMessage) => void): () => void {
  bus.on("msg", fn);
  return () => bus.off("msg", fn);
}

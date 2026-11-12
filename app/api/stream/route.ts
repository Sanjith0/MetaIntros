import { subscribe, visibleTo } from "@/lib/server/bus";
import { onTrace } from "@/lib/server/trace";
import { connect, connectScreen } from "@/lib/server/phones";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import type { PQEvent } from "@/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-sent events. Each browser hears only the events whose audience
 *  includes its viewer; the stage hears events marked for the stage. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") === "1";
  // An observer (operator screen) hears nothing personal and is not counted as a connected phone.
  const observer = url.searchParams.get("observer") === "1";
  const userId = stage || observer ? undefined : await currentViewerId();
  const since = Number(url.searchParams.get("since") ?? "NaN");
  const enc = new TextEncoder();

  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (e: PQEvent) => {
        if (!visibleTo(e, { userId, stage })) return;
        try {
          ctrl.enqueue(enc.encode(`id: ${e.seq}\nevent: pq\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          cleanup();
        }
      };
      // The hello carries the server clock so phones can report lag in server time.
      ctrl.enqueue(enc.encode(`retry: 1000\nevent: hello\ndata: ${JSON.stringify({ seq: store().seq, userId: userId ?? null, now: Date.now() })}\n\n`));
      const disconnect = userId ? connect(userId) : stage ? connectScreen("stage") : () => {};
      if (Number.isFinite(since)) store().events_log.filter((e) => e.seq > since).forEach(send);
      const off = subscribe(send);
      // Only the projector hears traces, including the private lane.
      const offTrace = stage
        ? onTrace((t) => {
            try {
              ctrl.enqueue(enc.encode(`event: trace\ndata: ${JSON.stringify(t)}\n\n`));
            } catch {
              cleanup();
            }
          })
        : () => {};
      const ping = setInterval(() => {
        try {
          ctrl.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15_000);
      cleanup = () => {
        off();
        offTrace();
        disconnect();
        clearInterval(ping);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          ctrl.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

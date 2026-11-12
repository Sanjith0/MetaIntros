import { subscribe } from "@/lib/server/bus";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topics = new Set((url.searchParams.get("topics") ?? "").split(",").filter(Boolean));
  const userId = await getCurrentUserId();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          /* closed */
        }
      };
      send(`retry: 2000\n: connected\n\n`);
      const unsub = subscribe((m) => {
        if (topics.size && !topics.has(m.topic)) return;
        if (m.userIds && !m.userIds.includes(userId)) return;
        send(`event: ${m.topic}\ndata: ${JSON.stringify(m.data ?? {})}\n\n`);
      });
      const hb = setInterval(() => send(`: hb\n\n`), 15_000);
      const close = () => {
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

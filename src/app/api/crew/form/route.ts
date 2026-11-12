import { formCrew } from "@/lib/agent";
import type { QueueFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

// Streams the agent's steps as NDJSON so the UI can show its reasoning live.
export async function POST(req: Request) {
  const { eventId, userId, filters } = (await req.json()) as { eventId: string; userId: string; filters: QueueFilters };
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const step of formCrew(eventId, userId, filters)) ctrl.enqueue(enc.encode(JSON.stringify(step) + "\n"));
      } catch (e) {
        ctrl.enqueue(enc.encode(JSON.stringify({ type: "error", message: (e as Error).message }) + "\n"));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

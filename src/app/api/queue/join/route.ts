import { joinQueue } from "@/lib/store";
import type { QueueFilters } from "@/lib/types";

export async function POST(req: Request) {
  const b = (await req.json()) as { eventId: string; userId: string; filters: QueueFilters; interests?: string[] };
  const t = joinQueue({ eventId: b.eventId, userId: b.userId, filters: b.filters, interests: b.interests });
  return Response.json(t);
}

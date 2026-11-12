import { LANDMARKS, profileById } from "@/data/seed";
import { bucketFor } from "@/lib/geo";
import { crewFor, visibleQueue } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const eventId = u.searchParams.get("eventId")!;
  const userId = u.searchParams.get("userId")!;
  const me = profileById(userId);
  if (!me) return Response.json({ error: "unknown user" }, { status: 404 });
  const bucket = bucketFor(me);
  const q = visibleQueue(eventId);
  const near = q.filter((t) => t.bucketId === bucket.id);
  const crew = crewFor(eventId, userId);
  return Response.json({
    bucket,
    landmarks: LANDMARKS,
    total: q.length,
    nearby: near.map((t) => {
      const p = profileById(t.userId)!;
      return { id: p.id, name: p.name, hue: p.hue, lat: p.lat, lng: p.lng };
    }),
    inQueue: q.some((t) => t.userId === userId),
    crewId: crew?.id ?? null,
  });
}

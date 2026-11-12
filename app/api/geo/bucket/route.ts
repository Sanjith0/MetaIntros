import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assignBucket } from "@/lib/match/buckets";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ ok: false, error: "bad coords" }, { status: 400 });
  const r = assignBucket({ lat, lng }, await prisma.landmark.findMany());
  return NextResponse.json(r.ok ? { ok: true, landmarkId: r.landmark.id, name: r.landmark.name, km: r.km } : { ok: false, reason: r.reason, km: r.km });
}

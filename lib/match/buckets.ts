import { haversineKm, nearestLandmark, type Landmarkish, type LatLng } from "@/lib/geo";

/** Beyond this distance from every landmark, GPS is ignored and the user picks an area. */
export const MAX_BUCKET_KM = 15;

export type BucketResult<T> = { ok: true; landmark: T; km: number } | { ok: false; reason: "too_far"; nearest: T; km: number };

export function assignBucket<T extends Landmarkish>(p: LatLng, landmarks: T[], maxKm = MAX_BUCKET_KM): BucketResult<T> {
  const { landmark, km } = nearestLandmark(p, landmarks);
  if (km > maxKm) return { ok: false, reason: "too_far", nearest: landmark, km };
  return { ok: true, landmark, km };
}

/** Pairwise landmark distances, used when search widens to neighbouring buckets. */
export function bucketDistanceKm<T extends Landmarkish>(a: string, b: string, byId: Map<string, T>): number {
  if (a === b) return 0;
  const x = byId.get(a), y = byId.get(b);
  if (!x || !y) return Infinity;
  return haversineKm(x, y);
}

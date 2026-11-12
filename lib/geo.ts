export interface LatLng {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Landmarkish extends LatLng {
  id: string;
}

/**
 * Nearest landmark. Ties (within 1 m) are broken by landmark id so assignment is
 * deterministic regardless of input order.
 */
export function nearestLandmark<T extends Landmarkish>(p: LatLng, landmarks: T[]): { landmark: T; km: number } {
  if (landmarks.length === 0) throw new Error("No landmarks");
  let best: { landmark: T; km: number } | null = null;
  for (const lm of landmarks) {
    const km = haversineKm(p, lm);
    if (!best || km < best.km - 0.001 || (Math.abs(km - best.km) <= 0.001 && lm.id < best.landmark.id)) {
      best = { landmark: lm, km };
    }
  }
  return best!;
}

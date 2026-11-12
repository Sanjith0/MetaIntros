import { LANDMARKS } from "@/data/seed";

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Proximity bucket = nearest landmark. Deliberately simple (see PRD). */
export function bucketFor(p: { lat: number; lng: number }) {
  let best = LANDMARKS[0];
  let bestD = Infinity;
  for (const lm of LANDMARKS) {
    const d = distanceKm(p, lm);
    if (d < bestD) {
      bestD = d;
      best = lm;
    }
  }
  return best;
}

/** Walking minutes at ~4.8 km/h with a 1.3 street-grid factor. */
export const walkMinutes = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.max(1, Math.round(((distanceKm(a, b) * 1.3) / 4.8) * 60));

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const pretty = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

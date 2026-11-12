import { describe, expect, it } from "vitest";
import LANDMARKS from "@/data/seed/landmarks.json";
import { assignBucket, bucketDistanceKm, MAX_BUCKET_KM } from "@/lib/match/buckets";
import { haversineKm, nearestLandmark } from "@/lib/geo";

const byId = new Map(LANDMARKS.map((l) => [l.id, l]));

describe("proximity buckets", () => {
  it.each([
    [{ lat: 37.4296, lng: -122.1699 }, "lm-stanford-oval"],
    [{ lat: 37.4447, lng: -122.1625 }, "lm-downtown-pa"], // Lytton Plaza
    [{ lat: 37.4850, lng: -122.1480 }, "lm-meta-campus"],
    [{ lat: 37.4870, lng: -122.2290 }, "lm-rwc-courthouse"],
    [{ lat: 37.4530, lng: -122.1800 }, "lm-menlo-caltrain"],
    [{ lat: 37.4270, lng: -122.1440 }, "lm-cal-ave"],
    [{ lat: 37.4300, lng: -122.0840 }, "lm-shoreline"],
  ])("assigns %o to %s", (p, id) => {
    const r = assignBucket(p, LANDMARKS);
    expect(r.ok).toBe(true);
    expect(r.ok && r.landmark.id).toBe(id);
  });

  it("breaks exact ties deterministically by landmark id, independent of input order", () => {
    const a = { id: "b-landmark", lat: 37.0, lng: -122.0 };
    const b = { id: "a-landmark", lat: 37.0, lng: -122.2 };
    const mid = { lat: 37.0, lng: -122.1 };
    expect(haversineKm(mid, a)).toBeCloseTo(haversineKm(mid, b), 6);
    expect(nearestLandmark(mid, [a, b]).landmark.id).toBe("a-landmark");
    expect(nearestLandmark(mid, [b, a]).landmark.id).toBe("a-landmark");
  });

  it("rejects GPS more than 15 km from every landmark (user must pick an area)", () => {
    const sf = { lat: 37.7793, lng: -122.4193 };
    const r = assignBucket(sf, LANDMARKS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("too_far");
      expect(r.km).toBeGreaterThan(MAX_BUCKET_KM);
    }
  });

  it("measures distance between buckets", () => {
    expect(bucketDistanceKm("lm-downtown-pa", "lm-downtown-pa", byId)).toBe(0);
    const d = bucketDistanceKm("lm-downtown-pa", "lm-stanford-shopping", byId);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(2);
    expect(bucketDistanceKm("lm-downtown-pa", "nope", byId)).toBe(Infinity);
  });
});

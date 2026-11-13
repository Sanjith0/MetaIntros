import { describe, expect, it } from "vitest";
import { stripCitations } from "@/lib/companion/text";

describe("stripCitations", () => {
  it("removes fact citations the model wrote into a sentence", () => {
    expect(stripCitations("Tara is active [live-dbe3dba0:socialStyle], and they climb at Peninsula Boulders and are part of Bay Area Climbers Coalition [live-dbe3dba0:likes[0]] [live-dbe3dba0:groups[0]]."))
      .toBe("Tara is active, and they climb at Peninsula Boulders and are part of Bay Area Climbers Coalition.");
    expect(stripCitations("Into vinyl (p05:likes[2], p05:music[0]) and film.")).toBe("Into vinyl and film.");
    expect(stripCitations("Big on bouldering (cites: p12:groups[1])")).toBe("Big on bouldering");
    expect(stripCitations("They skip loud bars p01:x_not_interested[0].")).toBe("They skip loud bars.");
  });

  it("leaves ordinary text alone", () => {
    for (const t of ["Saturday at 7:30 sounds good: see you there.", "Ratio 3:1 [sic] is fine.", "", "No colons here"]) expect(stripCitations(t)).toBe(t);
  });
});

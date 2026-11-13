import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initials } from "@/components/fb/Avatar";
import { characterTraits } from "@/components/fb/Character";

describe("avatar initials", () => {
  it("never splits surrogate pairs (hydration-safe)", () => {
    expect(initials("Roommates 🏠")).toBe("R");
    expect(initials("Jordan Lee")).toBe("JL");
    expect(initials("Tomás Müller")).toBe("TM");
    expect(initials("🏠 🎉")).toBe("?");
    for (const n of ["Roommates 🏠", "🔥 Squad"]) expect(initials(n)).not.toMatch(/[\uD800-\uDFFF]/);
  });
});

describe("drawn avatar characters", () => {
  const names = Object.values(JSON.parse(readFileSync("data/seed/people.json", "utf8")) as Record<string, { first: string; last: string }>).map((p) => `${p.first} ${p.last}`);

  it("are the same for the same name (server and client agree)", () => {
    expect(characterTraits("Jordan Lee")).toEqual(characterTraits("Jordan Lee"));
  });

  it("vary across the seeded people", () => {
    const traits = names.map(characterTraits);
    expect(new Set(traits.map((t) => t.haircut)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(traits.map((t) => t.skin)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(traits.map((t) => t.hair)).size).toBeGreaterThanOrEqual(5);
  });
});

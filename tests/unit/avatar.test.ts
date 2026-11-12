import { describe, expect, it } from "vitest";
import { initials } from "@/components/fb/Avatar";

describe("avatar initials", () => {
  it("never splits surrogate pairs (hydration-safe)", () => {
    expect(initials("Roommates 🏠")).toBe("R");
    expect(initials("Jordan Lee")).toBe("JL");
    expect(initials("Tomás Müller")).toBe("TM");
    expect(initials("🏠 🎉")).toBe("?");
    for (const n of ["Roommates 🏠", "🔥 Squad"]) expect(initials(n)).not.toMatch(/[\uD800-\uDFFF]/);
  });
});

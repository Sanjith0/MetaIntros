import { describe, expect, it } from "vitest";
import { initialsOf } from "@/components/Avatar";

describe("ui helpers", () => {
  it("initials use only words that start with a letter", () => {
    expect(initialsOf("Maya Okafor")).toBe("MO");
    expect(initialsOf("Robin (fair guest)")).toBe("R");
    expect(initialsOf("Kai")).toBe("K");
    expect(initialsOf("(  )")).toBe("?");
  });
});

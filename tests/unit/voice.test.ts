import { afterEach, describe, expect, it } from "vitest";
import { FLAG_NAMES, flag, flagDefault, setFlagOverride } from "@/lib/flags";

afterEach(() => setFlagOverride("VOICE_SENTENCE", null));

describe("voice sentence and runtime flags (F16)", () => {
  it("voice is off by default; every other layer is on by default", () => {
    expect(flag("VOICE_SENTENCE")).toBe(false);
    for (const name of FLAG_NAMES.filter((n) => n !== "VOICE_SENTENCE")) expect(flagDefault(name), name).toBe(true);
  });

  it("a runtime override wins, and null puts the default back", () => {
    setFlagOverride("VOICE_SENTENCE", true);
    expect(flag("VOICE_SENTENCE")).toBe(true);
    setFlagOverride("VOICE_SENTENCE", null);
    expect(flag("VOICE_SENTENCE")).toBe(false);
  });

  it("the environment can turn it on too", () => {
    process.env.PQ_FLAG_VOICE_SENTENCE = "1";
    expect(flag("VOICE_SENTENCE")).toBe(true);
    delete process.env.PQ_FLAG_VOICE_SENTENCE;
  });
});

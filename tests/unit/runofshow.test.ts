import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { BEATS, beatAt, DEMO_SECONDS, mmss } from "@/lib/demo/script";
import { flag } from "@/lib/flags";

describe("run of show (F35)", () => {
  it("is on by default", () => expect(flag("RUN_OF_SHOW")).toBe(true));

  it("nine beats, back to back, from 0:00 to exactly 5:00", () => {
    expect(BEATS).toHaveLength(9);
    expect(BEATS[0]!.at).toBe(0);
    expect(BEATS.at(-1)!.end).toBe(DEMO_SECONDS);
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i]!.at, BEATS[i]!.id).toBe(BEATS[i - 1]!.end);
    for (const b of BEATS) expect(b.end).toBeGreaterThan(b.at);
  });

  it("every link is a real page and every action a real API route", () => {
    for (const b of BEATS) {
      for (const s of b.show) {
        const route = s.href.replace(/^\//, "").replace(/^event\/[^/]+$/, "event/[id]");
        expect(fs.existsSync(`app/${route}/page.tsx`), s.href).toBe(true);
      }
      for (const a of b.actions) for (const c of a.calls) expect(fs.existsSync(`app${c.url}/route.ts`), c.url).toBe(true);
    }
  });

  it("knows the beat for any moment, and the clock format", () => {
    expect(beatAt(0).id).toBe("setup");
    expect(beatAt(65).id).toBe("table");
    expect(beatAt(299).id).toBe("proof");
    expect(beatAt(400).id).toBe("proof");
    expect(mmss(0)).toBe("0:00");
    expect(mmss(275)).toBe("4:35");
  });
});

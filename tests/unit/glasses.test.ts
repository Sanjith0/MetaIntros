import { afterEach, describe, expect, it } from "vitest";
import { Spotted } from "@/contracts";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { CLIP, playClip, stopClip } from "@/lib/door/clip";
import { FRAME_SOURCES } from "@/lib/door/source";
import { flag } from "@/lib/flags";
import { visibleTo } from "@/lib/server/bus";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

async function locked() {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => stopClip());

describe("glasses view and recorded clip (F9)", () => {
  it("is on by default, and the clip source says it is recorded", () => {
    expect(flag("GLASSES_VIEW")).toBe(true);
    expect(FRAME_SOURCES.find((f) => f.id === "recorded-clip")!.label).toMatch(/Recorded clip/);
  });

  it("the clip plays its frames in order, each Spotted labelled recorded, to Maya only", async () => {
    const pid = await locked();
    const { frames } = playClip("maya", pid, { speed: 50 });
    expect(frames).toBe(CLIP.frames.length);
    await wait(400);
    const spotted = store().spotted.filter((x) => x.partyId === pid);
    expect(spotted.map((x) => x.subjectId)).toEqual(["dev", "ana", "zoe", "kai"]);
    for (const x of spotted) {
      expect(Spotted.parse(x).method).toBe("recorded");
      expect(x.viewerId).toBe("maya");
    }
    const events = store().events_log.filter((e) => e.type === "member.spotted");
    for (const e of events) {
      expect(visibleTo(e, { userId: "maya" })).toBe(true);
      expect(visibleTo(e, { userId: "dev" })).toBe(false);
    }
  });

  it("stopping the clip stops the frames", async () => {
    const pid = await locked();
    playClip("maya", pid, { speed: 10 }); // frames at 0, 250, 500, 750 ms
    await wait(60);
    stopClip();
    await wait(900);
    expect(store().spotted.filter((x) => x.partyId === pid).map((x) => x.subjectId)).toEqual(["dev"]);
  });
});

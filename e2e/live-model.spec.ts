import { expect, test } from "@playwright/test";
import type { Icebreaker } from "../src/lib/types";
import { ME, filters, formCrew } from "./helpers";

// Runs against a server whose model calls go to scripts/fake-muse.mjs, to prove the
// model path (prompting, JSON parsing, validation) works end to end without a real key.
test.describe("model path (fake Muse)", () => {
  test("health reports muse", async ({ request }) => {
    expect((await (await request.get("/api/health")).json()).ai).toBe("muse");
  });

  test("crew is built from the model's JSON, including its swap", async ({ request }) => {
    const { steps, crew } = await formCrew(request, filters({ womenOnly: true }));
    expect(crew!.aiMode).toBe("muse");
    expect(crew!.vibe).toBe("Matcha & melancholy");
    expect(crew!.swaps[0]).toMatchObject({ out: "jordan", in: "noor" });
    expect(steps.some((s) => s.type === "step" && s.id === "think" && s.ai)).toBe(true);
    expect(crew!.plan.venueId).toBe("v-bluebonnet"); // parsed from a ```json fenced reply
  });

  test("icebreakers drop hooks citing evidence the pair doesn't share", async ({ request }) => {
    const { crew } = await formCrew(request, filters({ womenOnly: true }));
    const cards = (await (await request.get(`/api/crew/${crew!.id}/icebreakers?userId=${ME}`)).json()) as (Icebreaker & { ai: boolean })[];
    for (const c of cards) {
      expect(c.ai).toBe(true);
      expect(c.hooks.every((h) => h.evidence !== "likes:Nonexistent")).toBe(true);
      expect(c.opener).toBe("AI opener!");
    }
  });

  test("demo path UI shows Muse live", async ({ page, request }) => {
    await request.post("/api/reset");
    await page.goto("/events/pale-hour");
    await expect(page.getByTestId("ai-mode")).toHaveText("Muse live");
  });
});

test("pre-chat keeps grounded topics and drops invented ones", async ({ request }) => {
  const { crew } = await formCrew(request, filters({ womenOnly: true }));
  const chats = (await (await request.get(`/api/crew/${crew!.id}/prechat?userId=${ME}`)).json()) as { ai: boolean; topics: string[]; spark: number }[];
  for (const c of chats) {
    expect(c.ai).toBe(true);
    expect(c.topics).not.toContain("Underwater basket weaving");
    expect(c.spark).toBe(4);
  }
});

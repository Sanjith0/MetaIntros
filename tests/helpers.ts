import { expect, type APIRequestContext } from "@playwright/test";

/** Reset, queue all five demo members, and wait until code locks their plan. */
export async function lockedParty(request: APIRequestContext): Promise<string> {
  await request.post("/api/demo/reset");
  const start = await request.post("/api/demo/start", { data: { mode: "all" } });
  const { partyId } = (await start.json()) as { partyId: string };
  await expect
    .poll(
      async () => {
        const r = await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } });
        return ((await r.json()) as { view: { party: { status: string } } | null }).view?.party.status;
      },
      { timeout: 90_000, intervals: [500] },
    )
    .toBe("locked");
  return partyId;
}

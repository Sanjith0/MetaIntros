import { expect, test } from "@playwright/test";

/* F50: Maya types her sentence in Spanish; her private preview reads the same rules; the party locks the market; her words stay hers. */

test("one sentence in Spanish: the same rules, the same night, her words still private", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await request.post("/api/demo/start", { data: { mode: "four" } });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/queue?event=evt-rooftop");
  await page.getByTestId("sentence").fill("algo tranquilo, salgo a las once, menos de veinte dólares, sin consumo mínimo");
  const preview = page.getByTestId("brief-preview");
  for (const r of ["Done by 11 PM", "$20 or less", "No drink minimum"]) await expect(preview).toContainText(r);
  await expect(preview).toContainText("chill");
  await page.screenshot({ path: "shots/f50-spanish.png", animations: "disabled" });
  await page.getByTestId("join-queue").click();
  await expect
    .poll(async () => ((await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { status: string } } | null }).view?.party.status, {
      timeout: 90_000,
    })
    .toBe("locked");
  await page.goto("/party");
  await expect(page.getByTestId("party-plan-title")).toHaveText("Dolores Night Market");
  const mine = page.getByTestId("secret-mine");
  for (const w of ["salgo a las once", "menos de veinte dólares", "sin consumo mínimo"]) await expect(mine).toContainText(w);
  await expect(page.getByTestId("secret-party-knows")).toHaveAttribute("data-leaks", "0");
  const dev = await (await request.get("/api/party", { headers: { cookie: "pq_viewer=dev" } })).text();
  for (const w of ["salgo a las once", "menos de veinte", "sin consumo"]) expect(dev).not.toContain(w);
  await ctx.close();
});

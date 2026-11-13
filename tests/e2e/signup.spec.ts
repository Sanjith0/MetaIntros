import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady, reloadReady } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("two phones sign up live and get separate sessions", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await gotoReady(a, "/join");
  await a.getByTestId("join-submit").click();
  await expect(a.getByTestId("join-error")).toBeVisible();
  await a.getByTestId("join-name").fill("Riley");
  await a.getByTestId("join-age-18-24").click();
  await a.getByTestId("join-gender-woman").click();
  for (const t of ["climbing", "indie-music", "coffee", "film", "hiking"]) await a.getByTestId(`join-interest-${t}`).click();
  await a.getByTestId("join-submit").click();
  await expect(a).toHaveURL(/\/events/);
  await expect(a.getByTestId("me-avatar").getByRole("img")).toHaveAccessibleName(/^Riley/);

  await gotoReady(b, "/join");
  await b.getByTestId("join-name").fill("Morgan");
  await b.getByTestId("join-age-25+").click();
  await b.getByTestId("join-gender-none").click();
  await b.getByTestId("join-sample").click();
  await expect(b).toHaveURL(/\/events/);
  await expect(b.getByTestId("me-avatar").getByRole("img")).toHaveAccessibleName(/^Morgan/);

  // A is still A
  await reloadReady(a);
  await expect(a.getByTestId("me-avatar").getByRole("img")).toHaveAccessibleName(/^Riley/);
  // Without a session you're the presenter's "Me"
  const c = await (await browser.newContext()).newPage();
  await gotoReady(c, "/events");
  await expect(c.getByTestId("me-avatar").getByRole("img")).toHaveAccessibleName("Jordan Lee");
  await ctxA.close();
  await ctxB.close();
});

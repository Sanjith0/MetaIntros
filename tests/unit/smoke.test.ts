import { describe, expect, it } from "vitest";
import { checkDb, prisma } from "@/lib/db";
import { GET } from "@/app/api/health/route";

describe("smoke", () => {
  it("connects to the database", async () => {
    expect(await checkDb()).toBe(true);
  });

  it("can write and read a row", async () => {
    await prisma.appSetting.upsert({
      where: { key: "smoke" },
      create: { key: "smoke", value: "1" },
      update: { value: "1" },
    });
    const row = await prisma.appSetting.findUnique({ where: { key: "smoke" } });
    expect(row?.value).toBe("1");
  });

  it("health route reports ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });
});

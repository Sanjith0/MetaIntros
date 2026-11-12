import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLAG_NAMES, flag } from "@/lib/flags";

/* F18: the docs stay true to the code. */
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("docs (F18)", () => {
  it("the how page is on by default", () => expect(flag("HOW_PAGE")).toBe(true));

  it("the README lists every flag in lib/flags.ts", () => {
    const readme = read("README.md");
    for (const name of FLAG_NAMES) expect(readme, name).toContain(`\`${name}\``);
  });

  it("every route in the README's routes table exists", () => {
    const readme = read("README.md");
    const table = readme.slice(readme.indexOf("## Routes"), readme.indexOf("## The rules"));
    const routes = [...table.matchAll(/`(\/[a-z/[\]-]*)`/g)].map((m) => m[1]!);
    expect(routes.length).toBeGreaterThan(15);
    for (const r of routes) {
      const page = path.join("app", r === "/" ? "" : r, "page.tsx");
      expect(fs.existsSync(page), `${r} -> ${page}`).toBe(true);
    }
  });

  it("every file the architecture document cites exists", () => {
    const doc = read("docs/ARCHITECTURE.md");
    const files = [...doc.matchAll(/`((?:lib|contracts|app|components|tests|evals|model|fixtures)\/[\w./[\]-]+\.(?:ts|tsx|md|json))`/g)].map((m) => m[1]!);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(fs.existsSync(f), f).toBe(true);
  });

  it("the Devpost draft is honest about what ran", () => {
    const d = read("docs/DEVPOST.md");
    expect(d).toMatch(/simulated/i);
    expect(d).toMatch(/fictional/i);
    expect(d).toMatch(/Hackathon prototype, not Facebook/);
  });
});

describe("/how proof hub (F29)", () => {
  it("every guarantee points at a real page and a real test", async () => {
    const fs = await import("node:fs");
    const { GUARANTEES } = await import("@/lib/how");
    expect(GUARANTEES.length).toBeGreaterThanOrEqual(11);
    for (const g of GUARANTEES) {
      expect(fs.existsSync(g.test), g.test).toBe(true);
      const route = g.see.href.split("?")[0]!.replace(/^\//, "");
      expect(fs.existsSync(`app/${route}/page.tsx`), g.see.href).toBe(true);
    }
  });
});

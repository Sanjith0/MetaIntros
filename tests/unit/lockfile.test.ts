import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* npm on macOS can drop Linux-only optional packages from the lockfile, which
 * breaks `npm ci` in CI. Regenerate with: rm -rf node_modules package-lock.json && npm install */
describe("package-lock.json", () => {
  it("has entries for every @emnapi package that something depends on (CI installs on Linux)", () => {
    const lock = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8")) as { packages: Record<string, { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }> };
    const wanted = new Set<string>();
    for (const pkg of Object.values(lock.packages)) {
      for (const deps of [pkg.dependencies, pkg.optionalDependencies]) for (const name of Object.keys(deps ?? {})) if (name.startsWith("@emnapi/")) wanted.add(name);
    }
    const missing = [...wanted].filter((name) => !Object.keys(lock.packages).some((k) => k.endsWith(`node_modules/${name}`)));
    expect(missing, "regenerate the lockfile from scratch").toEqual([]);
  });
});

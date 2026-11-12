import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DESIGN.md guard: pages and feature components use tokens only. Event covers are content (exempt);
 * avatar colours are data, never literals in UI files.
 */
const ROOTS = ["app", "components"];
const EXEMPT = new Set(["components/events/EventCover.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx$/.test(p) ? [p] : [];
  });
}

const ui = ROOTS.flatMap(files).filter((f) => !EXEMPT.has(f));

const RULES: { name: string; re: RegExp; allow?: (file: string) => boolean }[] = [
  { name: "raw hex colour", re: /#[0-9a-fA-F]{3,8}\b(?![\w-])/ },
  { name: "rgb()/hsl() literal", re: /\b(?:rgba?|hsla?)\(/ },
  { name: "one-off shadow", re: /shadow-\[/ },
  { name: "gradient in chrome", re: /bg-gradient|from-\[|via-\[|to-\[#|linear-gradient|radial-gradient/ },
  { name: "purple/violet palette", re: /\b(?:text|bg|ring|border|from|to|via)-(?:purple|violet|indigo|fuchsia)-/ },
  { name: "letter-spaced caps", re: /tracking-(?:\[|wide|wider|widest)/ },
  { name: "monospace", re: /font-mono/ },
  { name: "capitals outside the date line", re: /\buppercase\b/, allow: (f) => f.endsWith("components/events/DateLine.tsx") },
  { name: "retired tokens", re: /\b(?:fb-blue|fb-bg|fb-muted|fb-text|fb-divider|queue-glow|fb-card|fb-green)\b/ },
  { name: "glow or glass", re: /drop-shadow-\[|backdrop-blur/ },
  { name: "emoji or ✦ as UI text", re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2726}]/u },
  { name: "Facebook wordmark", re: />\s*facebook\s*</i },
];

describe("design tokens (DESIGN.md)", () => {
  it("scans the UI files", () => {
    expect(ui.length).toBeGreaterThan(30);
  });
  for (const rule of RULES) {
    it(`no ${rule.name} in pages or feature components`, () => {
      const hits = ui
        .filter((f) => !rule.allow?.(f))
        .flatMap((f) =>
          readFileSync(f, "utf8")
            .split("\n")
            .map((line, i) => ({ f, i: i + 1, line }))
            .filter(({ line }) => rule.re.test(line) && !/^\s*(\/\/|\/\*|\*)/.test(line)),
        )
        .map(({ f, i, line }) => `${f}:${i}: ${line.trim().slice(0, 120)}`);
      expect(hits).toEqual([]);
    });
  }
});

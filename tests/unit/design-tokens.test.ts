import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DESIGN.md guard: pages and feature components use tokens only. Event covers and the drawn avatar
 * character are content (exempt); avatar colours are data, never literals in UI files.
 */
const ROOTS = ["app", "components"];
const EXEMPT = new Set(["components/events/EventCover.tsx", "components/fb/Character.tsx"]);

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

/**
 * Ratchet (DESIGN.md "Rules for components"): rules that existing files already break in places. Today's
 * counts per rule and file are recorded in design-baseline.json; a new violation fails, and so does a
 * count that went down without lowering the baseline, so the numbers can only fall. After fixing one:
 *   UPDATE_DESIGN_BASELINE=1 pnpm vitest run tests/unit/design-tokens.test.ts
 * components/fb/ is the design system itself and is exempt, as are event covers (content).
 */
const BASELINE_FILE = path.join("tests", "unit", "design-baseline.json");
const feature = ui.filter((f) => !f.startsWith(`components${path.sep}fb${path.sep}`));
const ALLOWED_IMPORT = /^(react|react-dom|next|next\/.+|lucide-react|@\/components\/.+|@\/lib\/.+|\.{1,2}\/.+|zod|qrcode)$/;

const RATCHET: { name: string; count: (src: string, file: string) => number }[] = [
  { name: "arbitrary Tailwind value", count: (s) => matches(s, /(?<![\w[-])-?[a-z][a-z0-9-]*-\[[^\]\s]+\]/g) },
  {
    name: "default palette colour",
    count: (s) =>
      matches(s, /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g) +
      matches(s, /\b(?:bg|text|border|ring|fill|stroke|outline|divide)-(?:white|black)\b/g),
  },
  { name: "default text size", count: (s) => matches(s, /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g) },
  { name: "default radius", count: (s) => matches(s, /\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?(?:-(?:xs|sm|md|lg|xl|2xl|3xl|4xl))?(?![\w-])/g) },
  { name: "dark: variant", count: (s) => matches(s, /\bdark:/g) },
  {
    name: "interface part not from components/fb",
    count: (s, file) =>
      code(s).filter((l) => {
        const m = l.match(/^\s*import\s.*?from\s+["']([^"']+)["']/);
        return m && !ALLOWED_IMPORT.test(m[1]);
      }).length + (file.startsWith(`app${path.sep}`) ? matches(s, /<(?:button|input|select|textarea|dialog)\b/g) : 0),
  },
];

function code(src: string) {
  return src.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l));
}
function matches(src: string, re: RegExp) {
  return code(src).reduce((n, l) => n + (l.match(re)?.length ?? 0), 0);
}

function currentCounts() {
  const out: Record<string, number> = {};
  for (const f of feature) {
    const src = readFileSync(f, "utf8");
    for (const r of RATCHET) {
      const n = r.count(src, f);
      if (n > 0) out[`${r.name} | ${f.split(path.sep).join("/")}`] = n;
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

describe("design ratchet (counts can only go down)", () => {
  const now = currentCounts();
  if (process.env.UPDATE_DESIGN_BASELINE === "1") writeFileSync(BASELINE_FILE, `${JSON.stringify(now, null, 2)}\n`);
  const base: Record<string, number> = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf8")) : {};

  it("adds no new violations", () => {
    const grew = Object.entries(now)
      .filter(([k, n]) => n > (base[k] ?? 0))
      .map(([k, n]) => `${k}: ${base[k] ?? 0} -> ${n}. Use the tokens and components/fb parts in DESIGN.md.`);
    expect(grew).toEqual([]);
  });

  it("baseline matches (lower it after a fix: UPDATE_DESIGN_BASELINE=1)", () => {
    const fell = Object.entries(base)
      .filter(([k, n]) => (now[k] ?? 0) < n)
      .map(([k, n]) => `${k}: ${n} -> ${now[k] ?? 0}`);
    expect(fell).toEqual([]);
  });
});

/**
 * Generate the seeded photos in public/images with Muse's image model (prompts: scripts/image-prompts.ts).
 * The files are committed, so the app and the e2e run never need the network for them.
 *
 *   pnpm images:gen                       # only files that don't exist yet
 *   pnpm images:gen --force               # regenerate everything
 *   pnpm images:gen covers/ev-karaoke     # just the keys that contain this text
 *
 * Needs MODEL_API_KEY (read from .env). About 20 seconds per image; runs 5 at a time.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PROMPTS, SHAPES, STYLE } from "./image-prompts";

// tsx doesn't read .env (Next.js does that for the app), so load it here.
if (existsSync(".env")) process.loadEnvFile(".env");

// sharp ships with Next.js; resolve it from there rather than adding a dependency.
const require = createRequire(import.meta.url);
type Pipeline = { resize(w: number, h: number, o: { fit: string; position: string }): Pipeline; webp(o: { quality: number }): Pipeline; toBuffer(): Promise<Buffer> };
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] })) as (input: Buffer) => Pipeline;

const OUT = "public/images";
const BASE = (process.env.MUSE_BASE_URL ?? "https://api.meta.ai/v1").replace(/\/$/, "");
const MODEL = process.env.MUSE_IMAGE_MODEL ?? "muse-image-1.0";
const CONCURRENCY = 5;

async function generate(prompt: string, size: string): Promise<Buffer> {
  const call = async (body: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MODEL_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") throw new Error("no image in response");
    return Buffer.from(b64, "base64");
  };
  const body = { model: MODEL, prompt: `${prompt} ${STYLE}`, n: 1 };
  try {
    return await call({ ...body, size });
  } catch (e) {
    // Not every size is accepted; a square image is cropped to shape below.
    if (size === "1024x1024" || !/HTTP 4\d\d/.test((e as Error).message)) throw e;
    return call({ ...body, size: "1024x1024" });
  }
}

async function main() {
  if (!process.env.MODEL_API_KEY) {
    console.log("No MODEL_API_KEY set: nothing generated.");
    return;
  }
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const filters = args.filter((a) => !a.startsWith("--"));
  const todo = Object.entries(PROMPTS).filter(([key]) => (filters.length ? filters.some((f) => key.includes(f)) : true) && (force || !existsSync(join(OUT, key))));
  console.log(`${todo.length} image(s) to generate with ${MODEL}`);

  let next = 0;
  let failed = 0;
  const worker = async () => {
    while (next < todo.length) {
      const [key, { shape, prompt }] = todo[next++];
      const s = SHAPES[shape];
      const t0 = Date.now();
      try {
        const raw = await generate(prompt, s.request);
        const file = join(OUT, key);
        mkdirSync(dirname(file), { recursive: true });
        const out = await sharp(raw).resize(s.width, s.height, { fit: "cover", position: "attention" }).webp({ quality: 74 }).toBuffer();
        writeFileSync(file, out);
        console.log(`✓ ${key} (${Math.round(out.length / 1024)} KB, ${Math.round((Date.now() - t0) / 1000)}s)`);
      } catch (e) {
        failed++;
        console.warn(`✗ ${key}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (failed) {
    console.warn(`${failed} failed. Run again to retry just those.`);
    process.exitCode = 1;
  }
}

main();

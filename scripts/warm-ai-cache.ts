/**
 * Warm data/ai-cache for the demo path by running the real pipeline once against Muse.
 * Usage: MODEL_API_KEY=... pnpm ai:warm   (≈ 5 model calls per squad; budget-capped)
 * Afterwards the demo replays these responses with no network ("Run from cache").
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

// tsx doesn't read .env (Next.js does that for the app), so load it here.
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DATABASE_URL = "file:./warm.db";
process.env.AI_MODE = "live";
process.env.AI_TIMEOUT_MS ??= "45000"; // warming isn't live; give the reasoning model time

async function main() {
  if (!process.env.MODEL_API_KEY) {
    console.log("No MODEL_API_KEY set — nothing to warm (the demo will use deterministic fallbacks).");
    return;
  }
  rmSync("prisma/warm.db", { force: true });
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env: process.env });
  const { prisma } = await import("../lib/db");
  const { seedDatabase } = await import("../lib/seed/seed");
  const { setSetting } = await import("../lib/server/settings");
  const { joinQueue, tick, cancelAllSims } = await import("../lib/server/queue");
  const { aiLog } = await import("../lib/ai");

  const paths: { eventId: string | null; size: number }[] = [
    { eventId: "ev-indie-guild", size: 6 }, // scripted demo path
    { eventId: "ev-indie-guild", size: 5 },
    { eventId: null, size: 6 }, // "anything this weekend"
  ];
  for (const p of paths) {
    await seedDatabase(prisma);
    await setSetting("simFillMs", "0");
    await joinQueue("p01", { eventId: p.eventId, targetSize: p.size, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await new Promise((r) => setTimeout(r, 500));
    const formed = await tick();
    console.log(`path ${p.eventId ?? "anything"} size ${p.size}: formed ${formed}`);
    cancelAllSims();
  }
  for (const l of aiLog()) console.log(`  ${l.task}: ${l.source} ${l.ms}ms ${l.error ?? ""}`);
  await prisma.$disconnect();
  process.exit(0);
}
main();

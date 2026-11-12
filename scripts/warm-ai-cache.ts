/**
 * Warm data/ai-cache for the demo path by running the real pipeline once against Muse.
 * Usage: MODEL_API_KEY=... pnpm ai:warm   (≈ 100 model calls per squad: the Companion engine runs a
 * room of 12; budget-capped by AI_MAX_CALLS). Pass path numbers to warm only some, e.g. `pnpm ai:warm 1`.
 * Afterwards the demo replays these responses with no network ("Run from cache").
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

// tsx doesn't read .env (Next.js does that for the app), so load it here.
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DATABASE_URL = "file:./warm.db";
process.env.AI_MODE = "live";
process.env.AI_TIMEOUT_MS ??= "120000"; // warming isn't live; batched Companion rounds are long answers from a reasoning model
process.env.AI_MAX_CALLS ??= "600";

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

  const paths: { eventId: string | null; size: number; mode?: "events" | "hangout" }[] = [
    { eventId: "ev-indie-guild", size: 6 }, // scripted demo path
    { eventId: "ev-indie-guild", size: 5 },
    { eventId: null, size: 6 }, // "any event this weekend"
    { eventId: null, size: 4, mode: "hangout" }, // "plan a new hangout"
  ];
  const only = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= paths.length);
  const run = only.length ? only.map((n) => paths[n - 1]) : paths;
  const { resetRooms } = await import("../lib/server/rooms");
  for (const p of run) {
    await seedDatabase(prisma);
    resetRooms();
    await setSetting("simFillMs", "0");
    const from = aiLog().length;
    const t0 = Date.now();
    await joinQueue("p01", { mode: p.mode, eventId: p.eventId, targetSize: p.size, landmarkId: "lm-downtown-pa", locationSource: "manual" });
    await new Promise((r) => setTimeout(r, 800));
    // The app's own ticker may already be running this room; keep ticking until the room has finished.
    let formed = 0;
    for (let i = 0; i < 900; i++) {
      formed += await tick();
      if (await prisma.matchRoom.findFirst({ where: { stage: { in: ["done", "waiting"] } } })) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    // The room is decided; now wait for the squad to be committed (event pick or hangout plan, host, talk cards).
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const forming = await prisma.party.count({ where: { status: "forming" } });
      const confirmed = await prisma.party.count({ where: { status: "confirmed" } });
      if (!forming && (confirmed ? (await prisma.talkCard.count()) > 0 : i >= 5)) break;
    }
    formed ||= await prisma.party.count({ where: { status: "confirmed" } });
    const log = aiLog().slice(from);
    const by = (src: string) => log.filter((l) => l.source === src).length;
    console.log(`path ${p.mode === "hangout" ? "hangout" : p.eventId ?? "any event"} size ${p.size}: formed ${formed} in ${Math.round((Date.now() - t0) / 1000)}s · live ${by("live")} · cache ${by("cache")} · fallback ${by("fallback")}`);
    const tasks = new Map<string, Record<string, number>>();
    for (const l of log) {
      const t = tasks.get(l.task) ?? {};
      t[l.source] = (t[l.source] ?? 0) + 1;
      tasks.set(l.task, t);
    }
    for (const [task, c] of [...tasks].sort()) console.log(`  ${task}: ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    for (const l of log.filter((x) => x.source === "fallback")) console.log(`  ! ${l.task} fell back after ${l.ms}ms: ${l.error ?? ""}`);
    const party = await prisma.party.findFirst({ where: { status: "confirmed", members: { some: { userId: "p01" } } }, include: { members: true } });
    console.log(party ? `  squad: ${party.members.map((m) => m.userId).join(", ")}\n  why: ${party.rationale}` : "  no squad formed for p01");
    cancelAllSims();
  }
  await prisma.$disconnect();
  process.exit(0);
}
main();

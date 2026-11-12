import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/seed/seed";

// tsx doesn't read .env (same fix as ai:warm). Values already set (e.g. by Playwright) win.
if (existsSync(".env")) process.loadEnvFile(".env");

const prisma = new PrismaClient();
const now = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date();

seedDatabase(prisma, { now })
  .then((r) => console.log(`seeded ${r.users} personas (now=${now.toISOString()})`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

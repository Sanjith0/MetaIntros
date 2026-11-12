import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/seed/seed";

const prisma = new PrismaClient();
const now = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date();

seedDatabase(prisma, { now })
  .then((r) => console.log(`seeded ${r.users} personas (now=${now.toISOString()})`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

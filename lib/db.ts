import { Prisma, PrismaClient } from "@prisma/client";
import { nowDate } from "@/lib/clock";

/**
 * Every `@default(now())` column (createdAt, joinedAt, lastReadAt, …) is filled from the global
 * clock (lib/clock.ts) instead of the wall clock — including nested creates (party → members,
 * chat → messages) — so stored timestamps always agree with event times, expiry and the UI.
 */
type ModelInfo = { nowFields: string[]; relations: Record<string, string> };
const MODELS = new Map<string, ModelInfo>(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    {
      nowFields: m.fields.filter((f) => f.kind === "scalar" && (f.default as { name?: string } | undefined)?.name === "now").map((f) => f.name),
      relations: Object.fromEntries(m.fields.filter((f) => f.kind === "object").map((f) => [f.name, f.type])),
    },
  ]),
);

type Rec = Record<string, unknown>;
const asList = (v: unknown): Rec[] => (Array.isArray(v) ? v : v && typeof v === "object" ? [v as Rec] : []);

/** Fill missing now-defaults on a create payload, then recurse into nested writes. */
function fillCreate(model: string, data: unknown) {
  const info = MODELS.get(model);
  if (!info) return;
  for (const row of asList(data)) {
    for (const f of info.nowFields) if (row[f] === undefined) row[f] = nowDate();
    fillNested(info, row);
  }
}

/** Nested writes inside a create/update payload (create, createMany, connectOrCreate, upsert). */
function fillNested(info: ModelInfo, row: Rec) {
  for (const [field, target] of Object.entries(info.relations)) {
    const w = row[field] as Rec | undefined;
    if (!w || typeof w !== "object") continue;
    if (w.create) fillCreate(target, w.create);
    if (w.createMany) fillCreate(target, (w.createMany as Rec).data);
    for (const c of asList(w.connectOrCreate)) fillCreate(target, c.create);
    for (const u of asList(w.upsert)) fillCreate(target, u.create);
  }
}

function makeClient() {
  const base = new PrismaClient();
  const ext = base.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          fillCreate(model, args.data);
          return query(args);
        },
        async createMany({ model, args, query }) {
          fillCreate(model, args.data);
          return query(args);
        },
        async createManyAndReturn({ model, args, query }) {
          fillCreate(model, args.data);
          return query(args);
        },
        async upsert({ model, args, query }) {
          fillCreate(model, args.create);
          const info = MODELS.get(model);
          if (info) fillNested(info, args.update as Rec);
          return query(args);
        },
        async update({ model, args, query }) {
          const info = MODELS.get(model);
          if (info) fillNested(info, args.data as Rec);
          return query(args);
        },
      },
    },
  });
  // Query extensions don't change result types, so the extended client is a drop-in PrismaClient.
  return ext as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPragmas?: Promise<void> };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * SQLite tuning for a single demo server with many concurrent readers (SSE, polling) and
 * occasional big write transactions (reset/reseed): WAL lets reads proceed during writes,
 * busy_timeout makes writers wait instead of failing.
 */
globalForPrisma.prismaPragmas ??= (async () => {
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
  } catch {
    /* non-fatal */
  }
})();

export async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

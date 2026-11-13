import type { PrismaClient } from "@prisma/client";

/**
 * Album photos, posts and share choices reference users and squads by plain id (no FK: those models
 * are owned elsewhere), so clear the rows left behind when an account or a squad is deleted. Reads
 * re-check existence anyway; this keeps a deleted person's photos from lingering in the DB.
 */
export async function purgeSocialOrphans(db: PrismaClient) {
  await db.$executeRawUnsafe(`DELETE FROM "AlbumPhoto" WHERE "uploaderId" NOT IN (SELECT "id" FROM "User") OR "partyId" NOT IN (SELECT "id" FROM "Party")`);
  await db.$executeRawUnsafe(`DELETE FROM "Post" WHERE "authorId" NOT IN (SELECT "id" FROM "User")`);
  await db.$executeRawUnsafe(`DELETE FROM "ShareChoice" WHERE "userId" NOT IN (SELECT "id" FROM "User") OR "partyId" NOT IN (SELECT "id" FROM "Party")`);
}

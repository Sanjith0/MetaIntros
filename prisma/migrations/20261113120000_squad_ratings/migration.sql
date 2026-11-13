-- Post-event squad ratings. New tables only; nothing existing is altered.

-- CreateTable
CREATE TABLE "SquadRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "eventId" TEXT,
    "stars" INTEGER,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MateRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rateeId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SquadRating_partyId_raterId_key" ON "SquadRating"("partyId", "raterId");
CREATE INDEX "SquadRating_raterId_idx" ON "SquadRating"("raterId");
CREATE UNIQUE INDEX "MateRating_partyId_raterId_rateeId_key" ON "MateRating"("partyId", "raterId", "rateeId");
CREATE INDEX "MateRating_raterId_idx" ON "MateRating"("raterId");
CREATE INDEX "MateRating_rateeId_idx" ON "MateRating"("rateeId");

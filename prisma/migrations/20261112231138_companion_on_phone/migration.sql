-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN "tonight" TEXT;

-- CreateTable
CREATE TABLE "CompanionRecap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "CompanionRecap_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanionRecap_partyId_userId_key" ON "CompanionRecap"("partyId", "userId");

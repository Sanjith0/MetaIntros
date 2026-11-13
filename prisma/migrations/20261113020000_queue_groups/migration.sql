-- Queue with friends. Plain ADD COLUMNs only (no QueueEntry table rebuild), so this migration
-- composes with other migrations that also add QueueEntry columns.

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN "groupId" TEXT;

-- AlterTable
ALTER TABLE "PartyMember" ADD COLUMN "groupId" TEXT;

-- CreateTable
CREATE TABLE "QueueGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'events',
    "eventId" TEXT,
    "targetPartySize" INTEGER NOT NULL DEFAULT 5,
    "bucketLandmarkId" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "locationSource" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'gathering',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    CONSTRAINT "QueueGroup_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "QueueGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QueueGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueueGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QueueEntry_groupId_idx" ON "QueueEntry"("groupId");

-- CreateIndex
CREATE INDEX "QueueGroupMember_userId_status_idx" ON "QueueGroupMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueGroupMember_groupId_userId_key" ON "QueueGroupMember"("groupId", "userId");

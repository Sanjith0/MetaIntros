-- CreateTable
CREATE TABLE "QueueGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QueueGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedById" TEXT,
    "via" TEXT NOT NULL DEFAULT 'invite',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QueueGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QueueEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'events',
    "eventId" TEXT,
    "targetPartySize" INTEGER NOT NULL DEFAULT 6,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "bucketLandmarkId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" DATETIME,
    "partyId" TEXT,
    "visibleToFriends" BOOLEAN NOT NULL DEFAULT false,
    "viaFriendId" TEXT,
    "parked" BOOLEAN NOT NULL DEFAULT false,
    "groupId" TEXT,
    CONSTRAINT "QueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_bucketLandmarkId_fkey" FOREIGN KEY ("bucketLandmarkId") REFERENCES "Landmark" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QueueGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QueueEntry" ("bucketLandmarkId", "eventId", "id", "joinedAt", "lat", "lng", "matchedAt", "mode", "parked", "partyId", "status", "targetPartySize", "userId", "viaFriendId", "visibleToFriends") SELECT "bucketLandmarkId", "eventId", "id", "joinedAt", "lat", "lng", "matchedAt", "mode", "parked", "partyId", "status", "targetPartySize", "userId", "viaFriendId", "visibleToFriends" FROM "QueueEntry";
DROP TABLE "QueueEntry";
ALTER TABLE "new_QueueEntry" RENAME TO "QueueEntry";
CREATE INDEX "QueueEntry_status_idx" ON "QueueEntry"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "QueueGroup_code_key" ON "QueueGroup"("code");

-- CreateIndex
CREATE INDEX "QueueGroupMember_userId_status_idx" ON "QueueGroupMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueGroupMember_groupId_userId_key" ON "QueueGroupMember"("groupId", "userId");


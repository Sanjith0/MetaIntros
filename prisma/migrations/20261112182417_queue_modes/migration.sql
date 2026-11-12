-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "isPublicVenue" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL,
    "coverColor" TEXT NOT NULL DEFAULT '#1877f2',
    "coverPattern" TEXT NOT NULL DEFAULT 'dots',
    "hostName" TEXT NOT NULL,
    "landmarkId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'event',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_landmarkId_fkey" FOREIGN KEY ("landmarkId") REFERENCES "Landmark" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("capacity", "coverColor", "coverPattern", "createdAt", "description", "endsAt", "hostName", "id", "isPublicVenue", "landmarkId", "lat", "lng", "startsAt", "tags", "title", "venueAddress", "venueName") SELECT "capacity", "coverColor", "coverPattern", "createdAt", "description", "endsAt", "hostName", "id", "isPublicVenue", "landmarkId", "lat", "lng", "startsAt", "tags", "title", "venueAddress", "venueName" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
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
    CONSTRAINT "QueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_bucketLandmarkId_fkey" FOREIGN KEY ("bucketLandmarkId") REFERENCES "Landmark" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QueueEntry" ("bucketLandmarkId", "eventId", "id", "joinedAt", "lat", "lng", "matchedAt", "partyId", "status", "targetPartySize", "userId") SELECT "bucketLandmarkId", "eventId", "id", "joinedAt", "lat", "lng", "matchedAt", "partyId", "status", "targetPartySize", "userId" FROM "QueueEntry";
DROP TABLE "QueueEntry";
ALTER TABLE "new_QueueEntry" RENAME TO "QueueEntry";
CREATE INDEX "QueueEntry_status_idx" ON "QueueEntry"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

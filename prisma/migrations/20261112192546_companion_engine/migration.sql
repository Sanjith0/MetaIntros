-- CreateTable
CREATE TABLE "CompanionBrief" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "shares" JSONB NOT NULL,
    "generated" JSONB,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanionBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "anchorUserId" TEXT NOT NULL,
    "userIds" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MatchRoom_anchorUserId_idx" ON "MatchRoom"("anchorUserId");

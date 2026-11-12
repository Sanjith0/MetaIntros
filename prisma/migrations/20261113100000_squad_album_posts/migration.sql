-- Squad album → posts & stories. New tables only; nothing existing is altered.

-- CreateTable
CREATE TABLE "AlbumPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "caption" TEXT,
    "shareable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'post',
    "caption" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT 'friends',
    "partyId" TEXT,
    "eventId" TEXT,
    "aiSource" TEXT,
    "aiEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PostPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PostPhoto_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "AlbumPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "postId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AlbumPhoto_partyId_createdAt_idx" ON "AlbumPhoto"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "AlbumPhoto_uploaderId_idx" ON "AlbumPhoto"("uploaderId");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_partyId_idx" ON "Post"("partyId");

-- CreateIndex
CREATE INDEX "PostPhoto_photoId_idx" ON "PostPhoto"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "PostPhoto_postId_photoId_key" ON "PostPhoto"("postId", "photoId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareChoice_partyId_userId_key" ON "ShareChoice"("partyId", "userId");

-- Friends' queues: opt-in visibility of the queues you're in, to your friends.
ALTER TABLE "User" ADD COLUMN "queueVisibility" TEXT NOT NULL DEFAULT 'off';
ALTER TABLE "User" ADD COLUMN "queueVisibilityAskedAt" DATETIME;
ALTER TABLE "QueueEntry" ADD COLUMN "visibleToFriends" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QueueEntry" ADD COLUMN "viaFriendId" TEXT;
ALTER TABLE "QueueEntry" ADD COLUMN "parked" BOOLEAN NOT NULL DEFAULT false;

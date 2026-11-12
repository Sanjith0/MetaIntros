-- Ready check ("I'm in"): squads wait for every real member to accept before the chat opens.
ALTER TABLE "Party" ADD COLUMN "acceptBy" DATETIME;
ALTER TABLE "PartyMember" ADD COLUMN "acceptedAt" DATETIME;

ALTER TABLE "ContentCollection"
  ADD COLUMN "coverUrl" TEXT,
  ADD COLUMN "audienceSpaceId" TEXT,
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "ContentCollection_audienceSpaceId_status_position_idx"
  ON "ContentCollection"("audienceSpaceId", "status", "position");
CREATE INDEX "ContentCollection_status_availableAt_expiresAt_idx"
  ON "ContentCollection"("status", "availableAt", "expiresAt");

ALTER TABLE "ContentCollection"
  ADD CONSTRAINT "ContentCollection_audienceSpaceId_fkey"
  FOREIGN KEY ("audienceSpaceId") REFERENCES "CommunitySpace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."ContentCollection" ENABLE ROW LEVEL SECURITY;

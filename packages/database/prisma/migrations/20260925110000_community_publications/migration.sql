-- Let the same community content entity represent both discussions and
-- longer publications. A space is optional so members can publish globally.
CREATE TYPE "CommunityPostKind" AS ENUM ('DISCUSSION', 'PUBLICATION');

ALTER TABLE "CommunityPost"
  ALTER COLUMN "spaceId" DROP NOT NULL,
  ADD COLUMN "kind" "CommunityPostKind" NOT NULL DEFAULT 'DISCUSSION',
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "excerpt" TEXT;

UPDATE "CommunityPost"
SET "excerpt" = LEFT("content", 360)
WHERE "excerpt" IS NULL;

ALTER TABLE "CommunityPost"
  DROP CONSTRAINT IF EXISTS "CommunityPost_spaceId_fkey";

ALTER TABLE "CommunityPost"
  ADD CONSTRAINT "CommunityPost_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "CommunitySpace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CommunityPost_kind_status_createdAt_idx"
  ON "CommunityPost"("kind", "status", "createdAt");

CREATE INDEX "CommunityPost_status_publishedAt_createdAt_idx"
  ON "CommunityPost"("status", "publishedAt", "createdAt");

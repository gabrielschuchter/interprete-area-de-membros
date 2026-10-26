ALTER TABLE "CommunityPost"
ADD COLUMN "coverAltText" TEXT;

CREATE INDEX "CommunityPost_authorId_status_updatedAt_id_idx"
ON "CommunityPost"("authorId", "status", "updatedAt", "id");

CREATE UNIQUE INDEX "CommunityPost_one_pinned_feed_idx"
ON "CommunityPost"("isPinned")
WHERE "isPinned" = TRUE
  AND "status" = 'PUBLISHED'
  AND "deletedAt" IS NULL
  AND "spaceId" IS NULL;

CREATE UNIQUE INDEX "CommunityPost_one_pinned_per_space_idx"
ON "CommunityPost"("spaceId")
WHERE "isPinned" = TRUE
  AND "status" = 'PUBLISHED'
  AND "deletedAt" IS NULL
  AND "spaceId" IS NOT NULL;

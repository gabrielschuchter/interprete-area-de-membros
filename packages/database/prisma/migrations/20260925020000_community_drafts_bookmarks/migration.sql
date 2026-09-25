-- Extend community posts with publication metadata and persistent bookmarks.
ALTER TABLE "CommunityPost" ADD COLUMN "slug" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CommunityPost" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CommunityPost_slug_key" ON "CommunityPost"("slug");

CREATE TABLE "CommunityBookmark" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityBookmark_postId_memberId_key" ON "CommunityBookmark"("postId", "memberId");
CREATE INDEX "CommunityBookmark_memberId_createdAt_idx" ON "CommunityBookmark"("memberId", "createdAt");

ALTER TABLE "CommunityBookmark" ADD CONSTRAINT "CommunityBookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBookmark" ENABLE ROW LEVEL SECURITY;

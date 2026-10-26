CREATE TABLE "CommunityPostShareLink" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "CommunityPostShareLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityPostShareLink_tokenHash_format_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "CommunityPostShareLink_tokenHash_key"
  ON "CommunityPostShareLink"("tokenHash");
CREATE INDEX "CommunityPostShareLink_postId_createdAt_idx"
  ON "CommunityPostShareLink"("postId", "createdAt");
CREATE INDEX "CommunityPostShareLink_createdById_createdAt_idx"
  ON "CommunityPostShareLink"("createdById", "createdAt");

ALTER TABLE "CommunityPostShareLink"
  ADD CONSTRAINT "CommunityPostShareLink_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunityPostShareLink_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunityPostShareLink" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CommunityPostShareLink" FROM anon, authenticated;

CREATE TABLE "CommunitySpaceInviteLink" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "CommunitySpaceInviteLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunitySpaceInviteLink_tokenHash_format_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "CommunitySpaceInviteLink_tokenHash_key"
  ON "CommunitySpaceInviteLink"("tokenHash");
CREATE INDEX "CommunitySpaceInviteLink_spaceId_createdAt_idx"
  ON "CommunitySpaceInviteLink"("spaceId", "createdAt");
CREATE UNIQUE INDEX "CommunitySpaceInviteLink_one_active_per_space"
  ON "CommunitySpaceInviteLink"("spaceId")
  WHERE "revokedAt" IS NULL;

ALTER TABLE "CommunitySpaceInviteLink"
  ADD CONSTRAINT "CommunitySpaceInviteLink_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "CommunitySpace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunitySpaceInviteLink_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunitySpaceInviteLink" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CommunitySpaceInviteLink" FROM anon, authenticated;

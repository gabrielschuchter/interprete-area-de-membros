CREATE TYPE "CommunitySpaceVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "CommunitySpaceMemberRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "CommunitySpaceInvitationStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'REVOKED'
);

ALTER TABLE "CommunitySpace"
  ADD COLUMN "normalizedTitle" TEXT,
  ADD COLUMN "details" TEXT,
  ADD COLUMN "coverUrl" TEXT,
  ADD COLUMN "visibility" "CommunitySpaceVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "NotificationPreference"
  ADD COLUMN "groupInvitations" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "groupPosts" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX "CommunitySpace_ownerId_normalizedTitle_key"
  ON "CommunitySpace"("ownerId", "normalizedTitle");
CREATE INDEX "CommunitySpace_visibility_status_position_idx"
  ON "CommunitySpace"("visibility", "status", "position");
CREATE INDEX "CommunitySpace_ownerId_status_idx"
  ON "CommunitySpace"("ownerId", "status");

ALTER TABLE "CommunitySpace"
  ADD CONSTRAINT "CommunitySpace_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommunitySpaceMember" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "role" "CommunitySpaceMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunitySpaceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunitySpaceMember_spaceId_memberId_key"
  ON "CommunitySpaceMember"("spaceId", "memberId");
CREATE INDEX "CommunitySpaceMember_memberId_joinedAt_idx"
  ON "CommunitySpaceMember"("memberId", "joinedAt");
CREATE INDEX "CommunitySpaceMember_spaceId_role_joinedAt_idx"
  ON "CommunitySpaceMember"("spaceId", "role", "joinedAt");

ALTER TABLE "CommunitySpaceMember"
  ADD CONSTRAINT "CommunitySpaceMember_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "CommunitySpace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunitySpaceMember_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunitySpaceInvitation" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "inviterId" TEXT,
  "status" "CommunitySpaceInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunitySpaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunitySpaceInvitation_inviteeId_status_createdAt_idx"
  ON "CommunitySpaceInvitation"("inviteeId", "status", "createdAt");
CREATE INDEX "CommunitySpaceInvitation_spaceId_inviteeId_status_idx"
  ON "CommunitySpaceInvitation"("spaceId", "inviteeId", "status");
CREATE INDEX "CommunitySpaceInvitation_inviterId_createdAt_idx"
  ON "CommunitySpaceInvitation"("inviterId", "createdAt");
CREATE UNIQUE INDEX "CommunitySpaceInvitation_one_pending_per_member"
  ON "CommunitySpaceInvitation"("spaceId", "inviteeId")
  WHERE "status" = 'PENDING';

ALTER TABLE "CommunitySpaceInvitation"
  ADD CONSTRAINT "CommunitySpaceInvitation_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "CommunitySpace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunitySpaceInvitation_inviteeId_fkey"
  FOREIGN KEY ("inviteeId") REFERENCES "Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CommunitySpaceInvitation_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."CommunitySpaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CommunitySpaceInvitation" ENABLE ROW LEVEL SECURITY;

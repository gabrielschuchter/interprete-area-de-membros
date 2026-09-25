-- Member profiles and editorial community topics.
-- The application uses Prisma server-side; RLS remains deny-by-default for the Data API.

CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "occupation" TEXT,
    "institution" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommunitySpace" ADD COLUMN "icon" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "contentJson" JSONB;
ALTER TABLE "CommunityPost" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Profile_clerkUserId_key" ON "Profile"("clerkUserId");
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");
CREATE INDEX "Profile_displayName_idx" ON "Profile"("displayName");
CREATE INDEX "CommunityPost_isPinned_status_createdAt_idx" ON "CommunityPost"("isPinned", "status", "createdAt");

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

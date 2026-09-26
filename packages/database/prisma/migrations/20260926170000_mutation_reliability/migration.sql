ALTER TABLE "CommunityPost"
    ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "CommunityPost_authorId_idempotencyKey_key"
    ON "CommunityPost"("authorId", "idempotencyKey");

ALTER TABLE "CommunityComment"
    ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "CommunityComment_authorId_idempotencyKey_key"
    ON "CommunityComment"("authorId", "idempotencyKey");

CREATE TABLE "MutationRateLimit" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MutationRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MutationRateLimit_memberId_action_windowStart_key"
    ON "MutationRateLimit"("memberId", "action", "windowStart");
CREATE INDEX "MutationRateLimit_memberId_action_updatedAt_idx"
    ON "MutationRateLimit"("memberId", "action", "updatedAt");
CREATE INDEX "MutationRateLimit_windowStart_idx"
    ON "MutationRateLimit"("windowStart");

ALTER TABLE "MutationRateLimit"
    ADD CONSTRAINT "MutationRateLimit_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MutationRateLimit" ENABLE ROW LEVEL SECURITY;

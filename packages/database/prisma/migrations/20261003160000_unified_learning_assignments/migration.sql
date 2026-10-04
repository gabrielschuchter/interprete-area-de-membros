CREATE TYPE "LearningAssignmentTargetType" AS ENUM (
  'ACTIVITY',
  'COURSE',
  'MODULE',
  'LESSON',
  'ASSET',
  'LIBRARY_ITEM',
  'EXERCISE_LIST'
);
CREATE TYPE "LearningAssignmentAudienceType" AS ENUM (
  'INDIVIDUAL',
  'SELECTED_MEMBERS',
  'GROUP',
  'ALL_MEMBERS'
);
CREATE TYPE "LearningAssignmentStatus" AS ENUM (
  'NEW',
  'VIEWED',
  'STARTED',
  'COMPLETED',
  'REVOKED'
);

ALTER TABLE "NotificationPreference"
  ADD COLUMN "contentAssignments" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE "LearningAssignmentBatch" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "targetType" "LearningAssignmentTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "audienceType" "LearningAssignmentAudienceType" NOT NULL,
  "audienceSpaceId" TEXT,
  "createdByMemberId" TEXT,
  "message" TEXT,
  "availableAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningAssignmentBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivityAssignment"
  ADD COLUMN "targetType" "LearningAssignmentTargetType" NOT NULL DEFAULT 'ACTIVITY',
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "assignedByMemberId" TEXT,
  ADD COLUMN "message" TEXT,
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "status" "LearningAssignmentStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "viewedAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3);

UPDATE "ActivityAssignment"
SET "targetId" = "activityId";

INSERT INTO "LearningAssignmentBatch" (
  "id", "targetType", "targetId", "audienceType", "createdByMemberId",
  "createdAt", "updatedAt"
)
SELECT
  'legacy-activity-batch:' || activityAssignment."activityId",
  'ACTIVITY'::"LearningAssignmentTargetType",
  activityAssignment."activityId",
  'SELECTED_MEMBERS'::"LearningAssignmentAudienceType",
  member.id,
  MIN(activityAssignment."assignedAt"),
  CURRENT_TIMESTAMP
FROM "ActivityAssignment" activityAssignment
LEFT JOIN "Activity" activity
  ON activity.id = activityAssignment."activityId"
LEFT JOIN "Member" member
  ON member.id = activity."createdBy"
GROUP BY activityAssignment."activityId", member.id
ON CONFLICT ("id") DO NOTHING;

UPDATE "ActivityAssignment" activityAssignment
SET
  "batchId" = 'legacy-activity-batch:' || activityAssignment."activityId",
  "assignedByMemberId" = member.id
FROM "Activity" activity
LEFT JOIN "Member" member
  ON member.id = activity."createdBy"
WHERE activity.id = activityAssignment."activityId";

UPDATE "ActivityAssignment" assignment
SET
  "status" = 'COMPLETED',
  "completedAt" = COALESCE(submission."submittedAt", submission."updatedAt")
FROM "ActivitySubmission" submission
WHERE submission."activityId" = assignment."activityId"
  AND submission."memberId" = assignment."memberId"
  AND submission."status" IN ('SUBMITTED', 'REVIEWED');

ALTER TABLE "ActivityAssignment"
  ALTER COLUMN "targetId" SET NOT NULL;

CREATE INDEX "LearningAssignmentBatch_targetType_targetId_createdAt_idx"
  ON "LearningAssignmentBatch"("targetType", "targetId", "createdAt");
CREATE INDEX "LearningAssignmentBatch_createdByMemberId_createdAt_idx"
  ON "LearningAssignmentBatch"("createdByMemberId", "createdAt");
CREATE INDEX "LearningAssignmentBatch_audienceSpaceId_createdAt_idx"
  ON "LearningAssignmentBatch"("audienceSpaceId", "createdAt");
CREATE UNIQUE INDEX "LearningAssignmentBatch_createdByMemberId_idempotencyKey_key"
  ON "LearningAssignmentBatch"("createdByMemberId", "idempotencyKey");
CREATE UNIQUE INDEX "ActivityAssignment_batchId_targetType_targetId_memberId_key"
  ON "ActivityAssignment"("batchId", "targetType", "targetId", "memberId");
CREATE INDEX "ActivityAssignment_memberId_status_assignedAt_idx"
  ON "ActivityAssignment"("memberId", "status", "assignedAt");
CREATE INDEX "ActivityAssignment_targetType_targetId_status_idx"
  ON "ActivityAssignment"("targetType", "targetId", "status");
CREATE INDEX "ActivityAssignment_batchId_memberId_idx"
  ON "ActivityAssignment"("batchId", "memberId");

DROP INDEX "ActivityAssignment_activityId_memberId_key";

ALTER TABLE "LearningAssignmentBatch"
  ADD CONSTRAINT "LearningAssignmentBatch_audienceSpaceId_fkey"
  FOREIGN KEY ("audienceSpaceId") REFERENCES "CommunitySpace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "LearningAssignmentBatch_createdByMemberId_fkey"
  FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityAssignment"
  ADD CONSTRAINT "ActivityAssignment_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "LearningAssignmentBatch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActivityAssignment_assignedByMemberId_fkey"
  FOREIGN KEY ("assignedByMemberId") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ActivityAssignment_target_matches_legacy_activity_check"
  CHECK (
    ("targetType" = 'ACTIVITY' AND "activityId" IS NOT NULL AND "targetId" = "activityId")
    OR ("targetType" <> 'ACTIVITY' AND "activityId" IS NULL)
  );

ALTER TABLE public."LearningAssignmentBatch" ENABLE ROW LEVEL SECURITY;

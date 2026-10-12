ALTER TABLE "Activity"
ADD COLUMN "rubricVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ActivityCohortTarget" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "activeKey" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityCohortTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityRubricCriterion" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRubricCriterion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityCohortTarget_activeKey_key" ON "ActivityCohortTarget"("activeKey");
CREATE INDEX "ActivityCohortTarget_activityId_revokedAt_idx" ON "ActivityCohortTarget"("activityId", "revokedAt");
CREATE INDEX "ActivityCohortTarget_cohortId_revokedAt_assignedAt_idx" ON "ActivityCohortTarget"("cohortId", "revokedAt", "assignedAt");
CREATE UNIQUE INDEX "ActivityRubricCriterion_activityId_version_position_key" ON "ActivityRubricCriterion"("activityId", "version", "position");
CREATE INDEX "ActivityRubricCriterion_activityId_version_idx" ON "ActivityRubricCriterion"("activityId", "version");

ALTER TABLE "ActivityCohortTarget"
ADD CONSTRAINT "ActivityCohortTarget_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityCohortTarget"
ADD CONSTRAINT "ActivityCohortTarget_cohortId_fkey"
FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivityCohortTarget"
ADD CONSTRAINT "ActivityCohortTarget_createdByMemberId_fkey"
FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityRubricCriterion"
ADD CONSTRAINT "ActivityRubricCriterion_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityCohortTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityRubricCriterion" ENABLE ROW LEVEL SECURITY;

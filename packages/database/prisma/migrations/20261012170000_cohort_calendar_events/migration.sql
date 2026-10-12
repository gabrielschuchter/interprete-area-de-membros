CREATE TABLE "CohortEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#6B5B64',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CohortEvent_createdByMemberId_idempotencyKey_key"
ON "CohortEvent"("createdByMemberId", "idempotencyKey");

CREATE INDEX "CohortEvent_cohortId_status_startsAt_idx"
ON "CohortEvent"("cohortId", "status", "startsAt");

CREATE INDEX "CohortEvent_cohortId_startsAt_endsAt_idx"
ON "CohortEvent"("cohortId", "startsAt", "endsAt");

ALTER TABLE "CohortEvent"
ADD CONSTRAINT "CohortEvent_cohortId_fkey"
FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CohortEvent"
ADD CONSTRAINT "CohortEvent_createdByMemberId_fkey"
FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CohortEvent" ENABLE ROW LEVEL SECURITY;

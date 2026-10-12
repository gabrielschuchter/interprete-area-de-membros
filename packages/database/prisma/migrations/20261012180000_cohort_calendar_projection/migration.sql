-- AlterTable
ALTER TABLE "CohortEvent" ADD COLUMN     "recurrence" "PlannerRecurrence" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "recurrenceUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "recurrenceUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CohortEventOccurrenceException" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStartsAt" TIMESTAMP(3) NOT NULL,
    "startsAtOverride" TIMESTAMP(3),
    "endsAtOverride" TIMESTAMP(3),
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "colorOverride" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CohortEventOccurrenceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortCalendarFeed" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CohortCalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingCohortTarget" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingCohortTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingOccurrenceException" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "occurrenceStartsAt" TIMESTAMP(3) NOT NULL,
    "startsAtOverride" TIMESTAMP(3),
    "endsAtOverride" TIMESTAMP(3),
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingOccurrenceException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CohortEventOccurrenceException_occurrenceStartsAt_cancelled_idx" ON "CohortEventOccurrenceException"("occurrenceStartsAt", "cancelledAt");
CREATE UNIQUE INDEX "CohortEventOccurrenceException_eventId_occurrenceStartsAt_key" ON "CohortEventOccurrenceException"("eventId", "occurrenceStartsAt");
CREATE UNIQUE INDEX "CohortCalendarFeed_tokenHash_key" ON "CohortCalendarFeed"("tokenHash");
CREATE INDEX "CohortCalendarFeed_cohortId_revokedAt_idx" ON "CohortCalendarFeed"("cohortId", "revokedAt");
CREATE INDEX "CohortCalendarFeed_memberId_revokedAt_idx" ON "CohortCalendarFeed"("memberId", "revokedAt");
CREATE UNIQUE INDEX "CohortCalendarFeed_memberId_cohortId_key" ON "CohortCalendarFeed"("memberId", "cohortId");
CREATE INDEX "MeetingCohortTarget_cohortId_revokedAt_assignedAt_idx" ON "MeetingCohortTarget"("cohortId", "revokedAt", "assignedAt");
CREATE INDEX "MeetingCohortTarget_meetingId_revokedAt_idx" ON "MeetingCohortTarget"("meetingId", "revokedAt");
CREATE UNIQUE INDEX "MeetingCohortTarget_meetingId_cohortId_key" ON "MeetingCohortTarget"("meetingId", "cohortId");
CREATE INDEX "MeetingOccurrenceException_occurrenceStartsAt_cancelledAt_idx" ON "MeetingOccurrenceException"("occurrenceStartsAt", "cancelledAt");
CREATE UNIQUE INDEX "MeetingOccurrenceException_meetingId_occurrenceStartsAt_key" ON "MeetingOccurrenceException"("meetingId", "occurrenceStartsAt");

-- AddForeignKey
ALTER TABLE "CohortEventOccurrenceException" ADD CONSTRAINT "CohortEventOccurrenceException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CohortEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CohortEventOccurrenceException" ADD CONSTRAINT "CohortEventOccurrenceException_updatedByMemberId_fkey" FOREIGN KEY ("updatedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CohortCalendarFeed" ADD CONSTRAINT "CohortCalendarFeed_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CohortCalendarFeed" ADD CONSTRAINT "CohortCalendarFeed_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingCohortTarget" ADD CONSTRAINT "MeetingCohortTarget_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingCohortTarget" ADD CONSTRAINT "MeetingCohortTarget_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingCohortTarget" ADD CONSTRAINT "MeetingCohortTarget_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingOccurrenceException" ADD CONSTRAINT "MeetingOccurrenceException_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingOccurrenceException" ADD CONSTRAINT "MeetingOccurrenceException_updatedByMemberId_fkey" FOREIGN KEY ("updatedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- This domain is server-only through Prisma; deny all direct Supabase Data API access.
ALTER TABLE "CohortEventOccurrenceException" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CohortCalendarFeed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingCohortTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingOccurrenceException" ENABLE ROW LEVEL SECURITY;

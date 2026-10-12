-- CreateEnum
CREATE TYPE "CohortLateJoinPolicy" AS ENUM ('ALL_ACTIVE', 'FROM_JOIN');

-- CreateEnum
CREATE TYPE "CohortMemberSource" AS ENUM ('MANUAL', 'CSV', 'INVITE', 'MOVE');

-- CreateEnum
CREATE TYPE "CohortMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "CohortReleaseMode" AS ENUM ('ALL_AT_ONCE', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "AccessGrantOrigin" AS ENUM ('DIRECT', 'COHORT', 'ASSIGNMENT', 'HISTORICAL');

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "lateJoinPolicy" "CohortLateJoinPolicy" NOT NULL DEFAULT 'ALL_ACTIVE',
    "readAfterEndDays" INTEGER NOT NULL DEFAULT 90,
    "notifyOnNews" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "createdByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortTeacher" (
    "cohortId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignedByMemberId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortTeacher_pkey" PRIMARY KEY ("cohortId","memberId")
);

-- CreateTable
CREATE TABLE "CohortMembership" (
    "id" TEXT NOT NULL,
    "activeKey" TEXT,
    "cohortId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "CohortMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "CohortMemberSource" NOT NULL DEFAULT 'MANUAL',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "movedFromCohortId" TEXT,
    "includePastReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortInvite" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortCourseAccess" (
    "id" TEXT NOT NULL,
    "activeKey" TEXT,
    "cohortId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "releaseMode" "CohortReleaseMode" NOT NULL DEFAULT 'ALL_AT_ONCE',
    "startsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortCourseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortLessonRelease" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortLessonRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrantSource" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "origin" "AccessGrantOrigin" NOT NULL,
    "originRefId" TEXT,
    "subjectMemberId" TEXT,
    "subjectCohortId" TEXT,
    "resourceType" "AccessResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "permission" "AccessPermission" NOT NULL DEFAULT 'VIEW',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrantSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_normalizedName_key" ON "Cohort"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_slug_key" ON "Cohort"("slug");

-- CreateIndex
CREATE INDEX "Cohort_archivedAt_startsAt_endsAt_idx" ON "Cohort"("archivedAt", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_createdByMemberId_idempotencyKey_key" ON "Cohort"("createdByMemberId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CohortTeacher_memberId_cohortId_idx" ON "CohortTeacher"("memberId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMembership_activeKey_key" ON "CohortMembership"("activeKey");

-- CreateIndex
CREATE INDEX "CohortMembership_cohortId_status_joinedAt_idx" ON "CohortMembership"("cohortId", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "CohortMembership_memberId_status_leftAt_idx" ON "CohortMembership"("memberId", "status", "leftAt");

-- CreateIndex
CREATE INDEX "CohortMembership_movedFromCohortId_idx" ON "CohortMembership"("movedFromCohortId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortInvite_tokenHash_key" ON "CohortInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CohortInvite_cohortId_revokedAt_expiresAt_idx" ON "CohortInvite"("cohortId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CohortCourseAccess_activeKey_key" ON "CohortCourseAccess"("activeKey");

-- CreateIndex
CREATE INDEX "CohortCourseAccess_cohortId_revokedAt_idx" ON "CohortCourseAccess"("cohortId", "revokedAt");

-- CreateIndex
CREATE INDEX "CohortCourseAccess_courseId_revokedAt_idx" ON "CohortCourseAccess"("courseId", "revokedAt");

-- CreateIndex
CREATE INDEX "CohortLessonRelease_cohortId_releaseAt_idx" ON "CohortLessonRelease"("cohortId", "releaseAt");

-- CreateIndex
CREATE INDEX "CohortLessonRelease_lessonId_releaseAt_idx" ON "CohortLessonRelease"("lessonId", "releaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "CohortLessonRelease_cohortId_lessonId_key" ON "CohortLessonRelease"("cohortId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrantSource_idempotencyKey_key" ON "AccessGrantSource"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AccessGrantSource_subjectMemberId_resourceType_resourceId_v_idx" ON "AccessGrantSource"("subjectMemberId", "resourceType", "resourceId", "validUntil");

-- CreateIndex
CREATE INDEX "AccessGrantSource_subjectCohortId_resourceType_resourceId_v_idx" ON "AccessGrantSource"("subjectCohortId", "resourceType", "resourceId", "validUntil");

-- CreateIndex
CREATE INDEX "AccessGrantSource_origin_originRefId_idx" ON "AccessGrantSource"("origin", "originRefId");

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortTeacher" ADD CONSTRAINT "CohortTeacher_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortTeacher" ADD CONSTRAINT "CohortTeacher_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortTeacher" ADD CONSTRAINT "CohortTeacher_assignedByMemberId_fkey" FOREIGN KEY ("assignedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortInvite" ADD CONSTRAINT "CohortInvite_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortInvite" ADD CONSTRAINT "CohortInvite_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortCourseAccess" ADD CONSTRAINT "CohortCourseAccess_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortCourseAccess" ADD CONSTRAINT "CohortCourseAccess_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortCourseAccess" ADD CONSTRAINT "CohortCourseAccess_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortLessonRelease" ADD CONSTRAINT "CohortLessonRelease_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortLessonRelease" ADD CONSTRAINT "CohortLessonRelease_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortLessonRelease" ADD CONSTRAINT "CohortLessonRelease_updatedByMemberId_fkey" FOREIGN KEY ("updatedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_subjectMemberId_fkey" FOREIGN KEY ("subjectMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_subjectCohortId_fkey" FOREIGN KEY ("subjectCohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_dates_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_read_after_end_days_check" CHECK ("readAfterEndDays" BETWEEN 0 AND 365);
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_version_check" CHECK ("version" >= 1);
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_state_check" CHECK (("status" = 'ACTIVE' AND "leftAt" IS NULL AND "activeKey" IS NOT NULL) OR ("status" = 'REMOVED' AND "leftAt" IS NOT NULL AND "activeKey" IS NULL));
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_version_check" CHECK ("version" >= 1);
ALTER TABLE "CohortInvite" ADD CONSTRAINT "CohortInvite_uses_check" CHECK ("maxUses" > 0 AND "usedCount" BETWEEN 0 AND "maxUses");
ALTER TABLE "CohortCourseAccess" ADD CONSTRAINT "CohortCourseAccess_active_key_check" CHECK (("revokedAt" IS NULL AND "activeKey" IS NOT NULL) OR ("revokedAt" IS NOT NULL AND "activeKey" IS NULL));
ALTER TABLE "CohortLessonRelease" ADD CONSTRAINT "CohortLessonRelease_version_check" CHECK ("version" >= 1);
ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_subject_check" CHECK (("subjectMemberId" IS NOT NULL) <> ("subjectCohortId" IS NOT NULL));
ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_validity_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom");

ALTER TABLE "Cohort" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CohortTeacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CohortMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CohortInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CohortCourseAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CohortLessonRelease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrantSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_origin_subject_check" CHECK (("subjectCohortId" IS NULL OR "origin" = 'COHORT') AND ("origin" <> 'COHORT' OR "subjectCohortId" IS NOT NULL));

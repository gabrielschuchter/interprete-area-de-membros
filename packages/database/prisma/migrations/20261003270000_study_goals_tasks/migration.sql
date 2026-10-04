CREATE TYPE "StudyActivityKind" AS ENUM ('LESSON', 'RECORDING', 'EXERCISE', 'ACTIVITY', 'COMMUNITY');
CREATE TYPE "StudyGoalPeriod" AS ENUM ('WEEKLY', 'MONTHLY');
CREATE TYPE "LearningTaskRecurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "StudyTrackingSession" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "clientSessionId" TEXT NOT NULL,
  "activityKind" "StudyActivityKind" NOT NULL,
  "resourceId" TEXT,
  "lastSequence" INTEGER NOT NULL DEFAULT -1,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "StudyTrackingSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyTrackingSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyTrackingSession_lastSequence_check" CHECK ("lastSequence" >= -1)
);
CREATE UNIQUE INDEX "StudyTrackingSession_memberId_clientSessionId_key" ON "StudyTrackingSession"("memberId", "clientSessionId");
CREATE INDEX "StudyTrackingSession_memberId_lastHeartbeatAt_idx" ON "StudyTrackingSession"("memberId", "lastHeartbeatAt");
CREATE INDEX "StudyTrackingSession_activityKind_resourceId_startedAt_idx" ON "StudyTrackingSession"("activityKind", "resourceId", "startedAt");

CREATE TABLE "StudyActivityInterval" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "seconds" INTEGER NOT NULL,
  "isPlayback" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyActivityInterval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyActivityInterval_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyActivityInterval_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudyTrackingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyActivityInterval_valid_interval_check" CHECK ("seconds" > 0 AND "seconds" <= 30 AND "endedAt" > "startedAt")
);
CREATE UNIQUE INDEX "StudyActivityInterval_sessionId_sequence_key" ON "StudyActivityInterval"("sessionId", "sequence");
CREATE INDEX "StudyActivityInterval_memberId_startedAt_idx" ON "StudyActivityInterval"("memberId", "startedAt");
CREATE INDEX "StudyActivityInterval_memberId_isPlayback_startedAt_idx" ON "StudyActivityInterval"("memberId", "isPlayback", "startedAt");

CREATE TABLE "StudyGoal" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "period" "StudyGoalPeriod" NOT NULL,
  "targetMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyGoal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyGoal_targetMinutes_positive_check" CHECK ("targetMinutes" > 0 AND "targetMinutes" <= 100800)
);
CREATE UNIQUE INDEX "StudyGoal_memberId_period_key" ON "StudyGoal"("memberId", "period");
CREATE INDEX "StudyGoal_memberId_updatedAt_idx" ON "StudyGoal"("memberId", "updatedAt");

CREATE TABLE "StudyGoalRevision" (
  "id" TEXT NOT NULL,
  "studyGoalId" TEXT NOT NULL,
  "targetMinutes" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyGoalRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyGoalRevision_studyGoalId_fkey" FOREIGN KEY ("studyGoalId") REFERENCES "StudyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyGoalRevision_targetMinutes_positive_check" CHECK ("targetMinutes" > 0 AND "targetMinutes" <= 100800)
);
CREATE INDEX "StudyGoalRevision_studyGoalId_changedAt_idx" ON "StudyGoalRevision"("studyGoalId", "changedAt");

CREATE TABLE "LearningTask" (
  "id" TEXT NOT NULL,
  "createdByMemberId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "recurrence" "LearningTaskRecurrence" NOT NULL DEFAULT 'ONCE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningTask_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LearningTask_valid_period_check" CHECK ("dueAt" IS NULL OR "dueAt" > "startsAt")
);
CREATE INDEX "LearningTask_createdByMemberId_archivedAt_dueAt_idx" ON "LearningTask"("createdByMemberId", "archivedAt", "dueAt");
CREATE INDEX "LearningTask_recurrence_startsAt_dueAt_idx" ON "LearningTask"("recurrence", "startsAt", "dueAt");

CREATE TABLE "LearningTaskRecipient" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningTaskRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningTaskRecipient_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearningTaskRecipient_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LearningTaskRecipient_taskId_memberId_key" ON "LearningTaskRecipient"("taskId", "memberId");
CREATE INDEX "LearningTaskRecipient_memberId_assignedAt_idx" ON "LearningTaskRecipient"("memberId", "assignedAt");

CREATE TABLE "LearningTaskCompletion" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningTaskCompletion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningTaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearningTaskCompletion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LearningTaskCompletion_taskId_memberId_periodKey_key" ON "LearningTaskCompletion"("taskId", "memberId", "periodKey");
CREATE INDEX "LearningTaskCompletion_memberId_completedAt_idx" ON "LearningTaskCompletion"("memberId", "completedAt");
CREATE INDEX "LearningTaskCompletion_taskId_periodKey_idx" ON "LearningTaskCompletion"("taskId", "periodKey");

CREATE TABLE "StudyCampaign" (
  "id" TEXT NOT NULL,
  "createdByMemberId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetMinutes" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyCampaign_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudyCampaign_valid_period_check" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "StudyCampaign_targetMinutes_positive_check" CHECK ("targetMinutes" > 0)
);
CREATE INDEX "StudyCampaign_publishedAt_archivedAt_startsAt_endsAt_idx" ON "StudyCampaign"("publishedAt", "archivedAt", "startsAt", "endsAt");

ALTER TABLE "StudyTrackingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyActivityInterval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGoalRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningTaskRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningTaskCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyCampaign" ENABLE ROW LEVEL SECURITY;

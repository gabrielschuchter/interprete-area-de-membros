-- CreateEnum
CREATE TYPE "PlannerTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "PlannerPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PlannerRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PlannerEventKind" AS ENUM ('PERSONAL', 'STUDY');

-- CreateEnum
CREATE TYPE "FocusTimerMode" AS ENUM ('STOPWATCH', 'FOCUS', 'SHORT_BREAK', 'LONG_BREAK', 'COUNTDOWN');

-- AlterEnum
ALTER TYPE "StudyActivityKind" ADD VALUE 'PERSONAL_TIMER';

-- CreateTable
CREATE TABLE "PlannerPreferences" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "focusMinutes" INTEGER NOT NULL DEFAULT 25,
    "shortBreakMinutes" INTEGER NOT NULL DEFAULT 5,
    "longBreakMinutes" INTEGER NOT NULL DEFAULT 15,
    "longBreakEvery" INTEGER NOT NULL DEFAULT 4,
    "timerSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "systemNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timerSoundType" TEXT NOT NULL DEFAULT 'SOFT_BELL',
    "timerVolume" INTEGER NOT NULL DEFAULT 70,
    "timerTickEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timerVibrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timerAutoAdvance" BOOLEAN NOT NULL DEFAULT false,
    "timerOpenFocusOnStart" BOOLEAN NOT NULL DEFAULT false,
    "keepScreenAwake" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerCalendarFeed" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerCalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerBoardColumn" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "PlannerTaskStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerBoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerTask" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlannerTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "PlannerPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "dueAt" TIMESTAMP(3),
    "recurrence" "PlannerRecurrence" NOT NULL DEFAULT 'NONE',
    "recurrenceUntil" TIMESTAMP(3),
    "reminderMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentTaskId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerTaskOccurrence" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "occurrenceAt" TIMESTAMP(3) NOT NULL,
    "dueAtOverride" TIMESTAMP(3),
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "status" "PlannerTaskStatus",
    "priority" "PlannerPriority",
    "deletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerTaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerEvent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PlannerEventKind" NOT NULL DEFAULT 'PERSONAL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#7A5A69',
    "location" TEXT,
    "recurrence" "PlannerRecurrence" NOT NULL DEFAULT 'NONE',
    "recurrenceUntil" TIMESTAMP(3),
    "reminderMinutes" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerEventOccurrence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "occurrenceStartsAt" TIMESTAMP(3) NOT NULL,
    "startsAtOverride" TIMESTAMP(3),
    "endsAtOverride" TIMESTAMP(3),
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "colorOverride" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerEventOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerReminder" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "occurrenceAt" TIMESTAMP(3),
    "remindAt" TIMESTAMP(3) NOT NULL,
    "domainEventId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusTimerSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mode" "FocusTimerMode" NOT NULL,
    "title" TEXT,
    "durationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runStartedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "elapsedBeforePause" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "linkedResourceType" TEXT,
    "linkedResourceId" TEXT,
    "studyLoggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusTimerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusTimerSessionSegment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "FocusTimerSessionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerNoteFolder" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "position" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerNoteFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerNote" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Sem título',
    "contentJson" JSONB NOT NULL,
    "contentText" TEXT NOT NULL DEFAULT '',
    "linkedResourceType" TEXT,
    "linkedResourceId" TEXT,
    "pinnedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerNoteTag" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerNoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerNoteTagAssignment" (
    "noteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "PlannerNoteTagAssignment_pkey" PRIMARY KEY ("noteId","tagId")
);

-- CreateTable
CREATE TABLE "GlobalSearchHistory" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannerPreferences_memberId_key" ON "PlannerPreferences"("memberId");
CREATE UNIQUE INDEX "PlannerCalendarFeed_memberId_key" ON "PlannerCalendarFeed"("memberId");
CREATE UNIQUE INDEX "PlannerCalendarFeed_tokenHash_key" ON "PlannerCalendarFeed"("tokenHash");
CREATE INDEX "PlannerCalendarFeed_updatedAt_idx" ON "PlannerCalendarFeed"("updatedAt");

-- CreateIndex
CREATE INDEX "PlannerPreferences_updatedAt_idx" ON "PlannerPreferences"("updatedAt");

-- CreateIndex
CREATE INDEX "PlannerBoardColumn_memberId_position_idx" ON "PlannerBoardColumn"("memberId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerBoardColumn_memberId_status_key" ON "PlannerBoardColumn"("memberId", "status");

-- CreateIndex
CREATE INDEX "PlannerTask_memberId_deletedAt_dueAt_status_idx" ON "PlannerTask"("memberId", "deletedAt", "dueAt", "status");

-- CreateIndex
CREATE INDEX "PlannerTask_memberId_status_sortOrder_idx" ON "PlannerTask"("memberId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "PlannerTask_parentTaskId_deletedAt_sortOrder_idx" ON "PlannerTask"("parentTaskId", "deletedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerTask_id_memberId_key" ON "PlannerTask"("id", "memberId");

-- CreateIndex
CREATE INDEX "PlannerTaskOccurrence_memberId_occurrenceAt_deletedAt_idx" ON "PlannerTaskOccurrence"("memberId", "occurrenceAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerTaskOccurrence_taskId_occurrenceAt_key" ON "PlannerTaskOccurrence"("taskId", "occurrenceAt");

-- CreateIndex
CREATE INDEX "PlannerEvent_memberId_deletedAt_startsAt_endsAt_idx" ON "PlannerEvent"("memberId", "deletedAt", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerEvent_id_memberId_key" ON "PlannerEvent"("id", "memberId");

-- CreateIndex
CREATE INDEX "PlannerEventOccurrence_memberId_occurrenceStartsAt_deletedA_idx" ON "PlannerEventOccurrence"("memberId", "occurrenceStartsAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerEventOccurrence_eventId_occurrenceStartsAt_key" ON "PlannerEventOccurrence"("eventId", "occurrenceStartsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerReminder_domainEventId_key" ON "PlannerReminder"("domainEventId");

-- CreateIndex
CREATE INDEX "PlannerReminder_memberId_remindAt_cancelledAt_deliveredAt_idx" ON "PlannerReminder"("memberId", "remindAt", "cancelledAt", "deliveredAt");

-- CreateIndex
CREATE INDEX "PlannerReminder_entityType_entityId_occurrenceAt_idx" ON "PlannerReminder"("entityType", "entityId", "occurrenceAt");

-- CreateIndex
CREATE INDEX "FocusTimerSession_memberId_startedAt_idx" ON "FocusTimerSession"("memberId", "startedAt");

-- CreateIndex
CREATE INDEX "FocusTimerSession_memberId_endedAt_startedAt_idx" ON "FocusTimerSession"("memberId", "endedAt", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusTimerSession_id_memberId_key" ON "FocusTimerSession"("id", "memberId");

-- CreateIndex
CREATE INDEX "FocusTimerSessionSegment_memberId_startedAt_endedAt_idx" ON "FocusTimerSessionSegment"("memberId", "startedAt", "endedAt");

-- CreateIndex
CREATE INDEX "PlannerNoteFolder_memberId_parentId_deletedAt_position_idx" ON "PlannerNoteFolder"("memberId", "parentId", "deletedAt", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerNoteFolder_memberId_name_key" ON "PlannerNoteFolder"("memberId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerNoteFolder_id_memberId_key" ON "PlannerNoteFolder"("id", "memberId");

-- CreateIndex
CREATE INDEX "PlannerNote_memberId_deletedAt_pinnedAt_updatedAt_idx" ON "PlannerNote"("memberId", "deletedAt", "pinnedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PlannerNote_folderId_deletedAt_updatedAt_idx" ON "PlannerNote"("folderId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerNote_id_memberId_key" ON "PlannerNote"("id", "memberId");

-- CreateIndex
CREATE INDEX "PlannerNoteTag_memberId_name_idx" ON "PlannerNoteTag"("memberId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerNoteTag_memberId_name_key" ON "PlannerNoteTag"("memberId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerNoteTag_id_memberId_key" ON "PlannerNoteTag"("id", "memberId");

-- CreateIndex
CREATE INDEX "PlannerNoteTagAssignment_memberId_noteId_idx" ON "PlannerNoteTagAssignment"("memberId", "noteId");

-- CreateIndex
CREATE INDEX "PlannerNoteTagAssignment_tagId_noteId_idx" ON "PlannerNoteTagAssignment"("tagId", "noteId");

-- CreateIndex
CREATE INDEX "GlobalSearchHistory_memberId_createdAt_idx" ON "GlobalSearchHistory"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSearchHistory_memberId_normalizedQuery_key" ON "GlobalSearchHistory"("memberId", "normalizedQuery");

-- AddForeignKey
ALTER TABLE "PlannerPreferences" ADD CONSTRAINT "PlannerPreferences_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannerCalendarFeed" ADD CONSTRAINT "PlannerCalendarFeed_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerBoardColumn" ADD CONSTRAINT "PlannerBoardColumn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_parentTaskId_memberId_fkey" FOREIGN KEY ("parentTaskId", "memberId") REFERENCES "PlannerTask"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTaskOccurrence" ADD CONSTRAINT "PlannerTaskOccurrence_taskId_memberId_fkey" FOREIGN KEY ("taskId", "memberId") REFERENCES "PlannerTask"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerEventOccurrence" ADD CONSTRAINT "PlannerEventOccurrence_eventId_memberId_fkey" FOREIGN KEY ("eventId", "memberId") REFERENCES "PlannerEvent"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerReminder" ADD CONSTRAINT "PlannerReminder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerReminder" ADD CONSTRAINT "PlannerReminder_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "DomainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusTimerSession" ADD CONSTRAINT "FocusTimerSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusTimerSessionSegment" ADD CONSTRAINT "FocusTimerSessionSegment_sessionId_memberId_fkey" FOREIGN KEY ("sessionId", "memberId") REFERENCES "FocusTimerSession"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNoteFolder" ADD CONSTRAINT "PlannerNoteFolder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNoteFolder" ADD CONSTRAINT "PlannerNoteFolder_parentId_memberId_fkey" FOREIGN KEY ("parentId", "memberId") REFERENCES "PlannerNoteFolder"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNote" ADD CONSTRAINT "PlannerNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNote" ADD CONSTRAINT "PlannerNote_folderId_memberId_fkey" FOREIGN KEY ("folderId", "memberId") REFERENCES "PlannerNoteFolder"("id", "memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNoteTag" ADD CONSTRAINT "PlannerNoteTag_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNoteTagAssignment" ADD CONSTRAINT "PlannerNoteTagAssignment_noteId_memberId_fkey" FOREIGN KEY ("noteId", "memberId") REFERENCES "PlannerNote"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerNoteTagAssignment" ADD CONSTRAINT "PlannerNoteTagAssignment_tagId_memberId_fkey" FOREIGN KEY ("tagId", "memberId") REFERENCES "PlannerNoteTag"("id", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalSearchHistory" ADD CONSTRAINT "GlobalSearchHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlannerPreferences" ADD CONSTRAINT "PlannerPreferences_timer_ranges_check" CHECK ("focusMinutes" BETWEEN 1 AND 180 AND "shortBreakMinutes" BETWEEN 1 AND 60 AND "longBreakMinutes" BETWEEN 1 AND 90 AND "longBreakEvery" BETWEEN 2 AND 8);
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_reminder_minutes_check" CHECK ("reminderMinutes" IS NULL OR "reminderMinutes" BETWEEN 0 AND 10080);
ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_time_range_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "PlannerEventOccurrence" ADD CONSTRAINT "PlannerEventOccurrence_colorOverride_check" CHECK ("colorOverride" IS NULL OR "colorOverride" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_reminder_minutes_check" CHECK ("reminderMinutes" IS NULL OR "reminderMinutes" BETWEEN 0 AND 10080);
ALTER TABLE "FocusTimerSession" ADD CONSTRAINT "FocusTimerSession_elapsed_nonnegative_check" CHECK ("elapsedBeforePause" >= 0);
ALTER TABLE "FocusTimerSession" ADD CONSTRAINT "FocusTimerSession_duration_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" BETWEEN 1 AND 86400);
CREATE UNIQUE INDEX "FocusTimerSession_one_open_per_member_key" ON "FocusTimerSession"("memberId") WHERE "endedAt" IS NULL;

ALTER TABLE "FocusTimerSession"
  ADD COLUMN "sessionNote" TEXT,
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manuallyEntered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clientId" TEXT;

ALTER TABLE "PlannerPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerCalendarFeed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerBoardColumn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerTaskOccurrence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerEventOccurrence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FocusTimerSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FocusTimerSessionSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerNoteFolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerNoteTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannerNoteTagAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GlobalSearchHistory" ENABLE ROW LEVEL SECURITY;

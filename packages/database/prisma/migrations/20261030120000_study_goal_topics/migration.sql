-- Additive only. A study goal (weekly or monthly minutes) can be split across
-- the member's themes of interest. Each row is the share of the goal reserved
-- for one theme; shares of a goal add up to at most 100.
CREATE TABLE IF NOT EXISTS "StudyGoalTopic" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "sharePercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGoalTopic_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudyGoalTopic_sharePercent_check" CHECK ("sharePercent" BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudyGoalTopic_goalId_topic_key" ON "StudyGoalTopic"("goalId", "topic");

ALTER TABLE "StudyGoalTopic" DROP CONSTRAINT IF EXISTS "StudyGoalTopic_goalId_fkey";
ALTER TABLE "StudyGoalTopic" ADD CONSTRAINT "StudyGoalTopic_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "StudyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Access happens only through Prisma on the server, like the other tables.
ALTER TABLE "StudyGoalTopic" ENABLE ROW LEVEL SECURITY;

-- Rollback (only with explicit approval, after confirming nothing reads it):
-- DROP TABLE IF EXISTS "StudyGoalTopic";

-- Metas por quantidade (aulas, leituras, exercícios), ao lado da meta em minutos.
CREATE TYPE "StudyCountGoalKind" AS ENUM ('LESSONS', 'READINGS', 'EXERCISES');

CREATE TABLE "StudyCountGoal" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "period" "StudyGoalPeriod" NOT NULL,
  "kind" "StudyCountGoalKind" NOT NULL,
  "target" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyCountGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyCountGoal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyCountGoal_target_check" CHECK ("target" > 0 AND "target" <= 1000)
);
CREATE UNIQUE INDEX "StudyCountGoal_memberId_period_kind_key" ON "StudyCountGoal"("memberId", "period", "kind");
CREATE INDEX "StudyCountGoal_memberId_updatedAt_idx" ON "StudyCountGoal"("memberId", "updatedAt");
ALTER TABLE "StudyCountGoal" ENABLE ROW LEVEL SECURITY;

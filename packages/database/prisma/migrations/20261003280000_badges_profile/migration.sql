CREATE TYPE "BadgeCriterion" AS ENUM (
  'STUDY_MINUTES',
  'STUDY_STREAK_DAYS',
  'STUDY_GOALS_MET',
  'EXERCISE_ANSWERS',
  'ACTIVITIES_COMPLETED',
  'COMMUNITY_PUBLICATIONS',
  'LESSONS_COMPLETED',
  'TASKS_COMPLETED'
);

CREATE TABLE "StudyGoalAchievement" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyGoalAchievement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyGoalAchievement_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "StudyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyGoalAchievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudyGoalAchievement_goalId_periodKey_key" ON "StudyGoalAchievement"("goalId", "periodKey");
CREATE INDEX "StudyGoalAchievement_memberId_achievedAt_idx" ON "StudyGoalAchievement"("memberId", "achievedAt");

CREATE TABLE "BadgeDefinition" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "criterion" "BadgeCriterion" NOT NULL,
  "threshold" INTEGER NOT NULL,
  "imageUrl" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BadgeDefinition_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BadgeDefinition_threshold_positive_check" CHECK ("threshold" > 0),
  CONSTRAINT "BadgeDefinition_version_positive_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "BadgeDefinition_slug_key" ON "BadgeDefinition"("slug");
CREATE UNIQUE INDEX "BadgeDefinition_criterion_threshold_slug_key" ON "BadgeDefinition"("criterion", "threshold", "slug");
CREATE INDEX "BadgeDefinition_status_criterion_threshold_idx" ON "BadgeDefinition"("status", "criterion", "threshold");
CREATE INDEX "BadgeDefinition_createdByMemberId_createdAt_idx" ON "BadgeDefinition"("createdByMemberId", "createdAt");

CREATE TABLE "BadgeDefinitionRevision" (
  "id" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "criterion" "BadgeCriterion" NOT NULL,
  "threshold" INTEGER NOT NULL,
  "imageUrl" TEXT,
  "createdByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BadgeDefinitionRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BadgeDefinitionRevision_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BadgeDefinitionRevision_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BadgeDefinitionRevision_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "BadgeDefinitionRevision_threshold_positive_check" CHECK ("threshold" > 0)
);
CREATE UNIQUE INDEX "BadgeDefinitionRevision_badgeId_version_key" ON "BadgeDefinitionRevision"("badgeId", "version");
CREATE INDEX "BadgeDefinitionRevision_createdByMemberId_createdAt_idx" ON "BadgeDefinitionRevision"("createdByMemberId", "createdAt");

CREATE TABLE "BadgeAward" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "definitionRevisionId" TEXT NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BadgeAward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BadgeAward_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BadgeAward_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BadgeAward_definitionRevisionId_fkey" FOREIGN KEY ("definitionRevisionId") REFERENCES "BadgeDefinitionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BadgeAward_memberId_badgeId_key" ON "BadgeAward"("memberId", "badgeId");
CREATE INDEX "BadgeAward_memberId_awardedAt_idx" ON "BadgeAward"("memberId", "awardedAt");
CREATE INDEX "BadgeAward_badgeId_awardedAt_idx" ON "BadgeAward"("badgeId", "awardedAt");

CREATE TABLE "BadgeEvaluationState" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "lastEvaluatedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BadgeEvaluationState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BadgeEvaluationState_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BadgeEvaluationState_memberId_key" ON "BadgeEvaluationState"("memberId");

INSERT INTO "BadgeDefinition" ("id", "slug", "title", "description", "criterion", "threshold", "status", "updatedAt") VALUES
  ('badge-first-lesson', 'primeira-aula', 'Primeira passagem', 'Conclua sua primeira aula publicada.', 'LESSONS_COMPLETED', 1, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-study-five-hours', 'cinco-horas-de-estudo', 'Cinco horas de estudo', 'Some cinco horas em intervalos educacionais ativos.', 'STUDY_MINUTES', 300, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-study-streak-week', 'sete-dias-de-estudo', 'Ritmo de uma semana', 'Estude em sete dias consecutivos.', 'STUDY_STREAK_DAYS', 7, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-study-goal-first', 'primeira-meta-alcancada', 'Meta alcançada', 'Complete uma meta pessoal semanal ou mensal.', 'STUDY_GOALS_MET', 1, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-exercise-twenty-five', 'vinte-e-cinco-questoes', 'Prática consistente', 'Responda vinte e cinco questões de exercício.', 'EXERCISE_ANSWERS', 25, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-five-activities', 'cinco-atividades', 'Caderno em movimento', 'Envie cinco atividades acadêmicas.', 'ACTIVITIES_COMPLETED', 5, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-five-publications', 'cinco-publicacoes', 'Voz em comunidade', 'Publique cinco contribuições na comunidade.', 'COMMUNITY_PUBLICATIONS', 5, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-ten-tasks', 'dez-tarefas-concluidas', 'Constância cotidiana', 'Conclua dez tarefas nos períodos registrados.', 'TASKS_COMPLETED', 10, 'PUBLISHED', CURRENT_TIMESTAMP);

INSERT INTO "BadgeDefinitionRevision" ("id", "badgeId", "version", "title", "description", "criterion", "threshold")
SELECT 'badge-revision-' || "slug" || '-v1', "id", 1, "title", "description", "criterion", "threshold"
FROM "BadgeDefinition";

ALTER TABLE "StudyGoalAchievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BadgeDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BadgeDefinitionRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BadgeAward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BadgeEvaluationState" ENABLE ROW LEVEL SECURITY;

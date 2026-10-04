CREATE TABLE "MeetingAttendance" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "isPresent" BOOLEAN NOT NULL DEFAULT false,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "markedByMemberId" TEXT,
  CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeetingAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MeetingAttendance_markedByMemberId_fkey" FOREIGN KEY ("markedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MeetingAttendance_meetingId_memberId_key" ON "MeetingAttendance"("meetingId", "memberId");
CREATE INDEX "MeetingAttendance_memberId_isPresent_markedAt_idx" ON "MeetingAttendance"("memberId", "isPresent", "markedAt");
CREATE INDEX "MeetingAttendance_markedByMemberId_markedAt_idx" ON "MeetingAttendance"("markedByMemberId", "markedAt");
ALTER TABLE "MeetingAttendance" ENABLE ROW LEVEL SECURITY;

INSERT INTO "BadgeDefinition" (
  "id", "slug", "title", "description", "criterion", "threshold", "status", "updatedAt"
) VALUES
  ('badge-first-learning-path', 'primeira-trilha-concluida', 'Percurso completo', 'Conclua uma trilha publicada de aprendizagem.', 'LEARNING_PATHS_COMPLETED', 1, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('badge-first-meeting-attended', 'primeiro-encontro-presente', 'Presença que conta', 'Tenha presença confirmada pela equipe em um encontro.', 'MEETINGS_ATTENDED', 1, 'PUBLISHED', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "BadgeDefinitionRevision" (
  "id", "badgeId", "version", "title", "description", "criterion", "threshold"
)
SELECT
  'badge-revision-' || "slug" || '-v1', "id", 1, "title", "description", "criterion", "threshold"
FROM "BadgeDefinition"
WHERE "slug" IN ('primeira-trilha-concluida', 'primeiro-encontro-presente')
ON CONFLICT ("badgeId", "version") DO NOTHING;

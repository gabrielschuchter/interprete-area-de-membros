-- Add a source for courses that are explicitly open to all active members.
ALTER TYPE "AccessGrantOrigin" ADD VALUE 'OPEN_ACCESS';

-- Keep one active global source per course while retaining revoked history.
CREATE UNIQUE INDEX "AccessGrantSource_activeOpenCourse_key"
ON "AccessGrantSource" ("resourceId")
WHERE "resourceType" = 'COURSE'
  AND "subjectMemberId" IS NULL
  AND "subjectCohortId" IS NULL
  AND "revokedAt" IS NULL;

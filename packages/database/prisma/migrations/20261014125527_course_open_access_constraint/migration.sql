-- OPEN_ACCESS is a global course source; individual and cohort sources
-- still require exactly one subject. Preserve all grants and their history.
ALTER TABLE "AccessGrantSource"
DROP CONSTRAINT "AccessGrantSource_subject_check",
ADD CONSTRAINT "AccessGrantSource_subject_check" CHECK (
  (
    "origin" = 'OPEN_ACCESS'
    AND "subjectMemberId" IS NULL
    AND "subjectCohortId" IS NULL
    AND "resourceType" = 'COURSE'
  )
  OR (
    "origin" <> 'OPEN_ACCESS'
    AND (("subjectMemberId" IS NOT NULL) <> ("subjectCohortId" IS NOT NULL))
  )
);

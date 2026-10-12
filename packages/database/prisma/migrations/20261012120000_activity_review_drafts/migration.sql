ALTER TABLE "ActivitySubmission"
ADD COLUMN "rubricVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Feedback"
ADD COLUMN "rubricVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "criteriaScores" JSONB,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "submittedAt" TIMESTAMP(3);

CREATE TABLE "ActivityFeedbackDraft" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "content" TEXT NOT NULL,
    "rubricVersion" INTEGER NOT NULL DEFAULT 0,
    "criteriaScores" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityFeedbackDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityFeedbackDraft_submissionId_key" ON "ActivityFeedbackDraft"("submissionId");
CREATE INDEX "ActivityFeedbackDraft_reviewerId_updatedAt_idx" ON "ActivityFeedbackDraft"("reviewerId", "updatedAt");

ALTER TABLE "ActivityFeedbackDraft"
ADD CONSTRAINT "ActivityFeedbackDraft_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "ActivitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityFeedbackDraft"
ADD CONSTRAINT "ActivityFeedbackDraft_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityFeedbackDraft" ENABLE ROW LEVEL SECURITY;

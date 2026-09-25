ALTER TABLE "Meeting" ADD COLUMN "courseId" TEXT;

CREATE INDEX "Meeting_courseId_startsAt_idx" ON "Meeting"("courseId", "startsAt");

ALTER TABLE "Meeting"
ADD CONSTRAINT "Meeting_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

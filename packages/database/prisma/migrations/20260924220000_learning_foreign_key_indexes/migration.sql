-- Add covering indexes for the learning-domain foreign keys.
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");

-- Índices aditivos para chaves estrangeiras sem índice líder (auditoria SIS-13).
-- Rollback: DROP INDEX IF EXISTS de cada índice abaixo.
CREATE INDEX IF NOT EXISTS "ContentCollectionItem_lessonId_idx" ON "ContentCollectionItem"("lessonId");
CREATE INDEX IF NOT EXISTS "ContentCollectionItem_courseId_idx" ON "ContentCollectionItem"("courseId");
CREATE INDEX IF NOT EXISTS "ContentCollectionItem_exerciseListId_idx" ON "ContentCollectionItem"("exerciseListId");
CREATE INDEX IF NOT EXISTS "ContentCollectionItem_assetId_idx" ON "ContentCollectionItem"("assetId");
CREATE INDEX IF NOT EXISTS "ContentCollectionItem_libraryItemId_idx" ON "ContentCollectionItem"("libraryItemId");
CREATE INDEX IF NOT EXISTS "ExerciseListItem_questionId_idx" ON "ExerciseListItem"("questionId");
CREATE INDEX IF NOT EXISTS "ExerciseQuestion_categoryId_idx" ON "ExerciseQuestion"("categoryId");
CREATE INDEX IF NOT EXISTS "Notification_actorId_idx" ON "Notification"("actorId");

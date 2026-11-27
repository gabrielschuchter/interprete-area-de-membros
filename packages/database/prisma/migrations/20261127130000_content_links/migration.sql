-- Vínculos de estudo entre aula, lista de exercícios e material da Biblioteca.
-- Aditivo: nada existente muda. Cada linha liga exatamente dois conteúdos.
CREATE TABLE "ContentLink" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT,
  "exerciseListId" TEXT,
  "libraryItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentLink_two_sides_check" CHECK (num_nonnulls("lessonId", "exerciseListId", "libraryItemId") = 2),
  CONSTRAINT "ContentLink_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentLink_exerciseListId_fkey" FOREIGN KEY ("exerciseListId") REFERENCES "ExerciseList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentLink_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContentLink_lessonId_exerciseListId_key" ON "ContentLink"("lessonId", "exerciseListId");
CREATE UNIQUE INDEX "ContentLink_lessonId_libraryItemId_key" ON "ContentLink"("lessonId", "libraryItemId");
CREATE UNIQUE INDEX "ContentLink_exerciseListId_libraryItemId_key" ON "ContentLink"("exerciseListId", "libraryItemId");
CREATE INDEX "ContentLink_lessonId_idx" ON "ContentLink"("lessonId");
CREATE INDEX "ContentLink_exerciseListId_idx" ON "ContentLink"("exerciseListId");
CREATE INDEX "ContentLink_libraryItemId_idx" ON "ContentLink"("libraryItemId");
ALTER TABLE "ContentLink" ENABLE ROW LEVEL SECURITY;

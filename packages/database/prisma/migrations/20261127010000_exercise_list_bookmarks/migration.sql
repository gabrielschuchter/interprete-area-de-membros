-- Listas de exercícios salvas pelo membro (marcador no card, com marcar e desmarcar).
CREATE TABLE "ExerciseListBookmark" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseListBookmark_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseListBookmark_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseListBookmark_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ExerciseList"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseListBookmark_memberId_listId_key" ON "ExerciseListBookmark"("memberId", "listId");
CREATE INDEX "ExerciseListBookmark_memberId_createdAt_idx" ON "ExerciseListBookmark"("memberId", "createdAt");
ALTER TABLE "ExerciseListBookmark" ENABLE ROW LEVEL SECURITY;

-- Título opcional em português para a Biblioteca (aditiva).
-- Materiais sem tradução continuam exibindo o título original (`title`).
-- Rollback: ALTER TABLE "LibraryItem" DROP COLUMN IF EXISTS "titlePt";
ALTER TABLE "LibraryItem"
  ADD COLUMN IF NOT EXISTS "titlePt" TEXT;

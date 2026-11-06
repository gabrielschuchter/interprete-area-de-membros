-- Enquadramento não destrutivo da capa da publicação (aditiva).
-- Publicações antigas ficam com NULL/padrões: foco central, zoom 1, sem dimensões.
-- Rollback: ALTER TABLE "CommunityPost" DROP COLUMN IF EXISTS "coverWidth", DROP COLUMN IF EXISTS "coverHeight", DROP COLUMN IF EXISTS "coverFocusX", DROP COLUMN IF EXISTS "coverFocusY", DROP COLUMN IF EXISTS "coverZoom";
ALTER TABLE "CommunityPost"
  ADD COLUMN IF NOT EXISTS "coverWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "coverHeight" INTEGER,
  ADD COLUMN IF NOT EXISTS "coverFocusX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "coverFocusY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "coverZoom" DOUBLE PRECISION NOT NULL DEFAULT 1;

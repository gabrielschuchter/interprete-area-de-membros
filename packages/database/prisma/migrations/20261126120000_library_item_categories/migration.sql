-- Categorias múltiplas na Biblioteca (aditiva).
-- `categories` guarda todas as estantes do material; `category` continua sendo
-- a categoria principal (a primeira da lista), então o que já lia `category`
-- segue funcionando.
-- Rollback: ALTER TABLE "LibraryItem" DROP COLUMN IF EXISTS "categories";
--   (os valores originais de `category` estão em "LibraryItemCategoryBackup20261126")
ALTER TABLE "LibraryItem"
  ADD COLUMN IF NOT EXISTS "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Converte as categorias combinadas em lista; as demais viram lista de um item.
UPDATE "LibraryItem"
SET "categories" = CASE "category"
  WHEN 'Revisões sistemáticas e busca'
    THEN ARRAY['Revisões sistemáticas', 'Busca da evidência']
  WHEN 'Fundamentos da PBE e busca'
    THEN ARRAY['Fundamentos da PBE', 'Busca da evidência']
  WHEN 'Leitura crítica e certeza da evidência e risco de viés'
    THEN ARRAY['Leitura crítica e certeza da evidência', 'Risco de viés']
  WHEN 'Leitura crítica e certeza da evidência e revisão sistemática'
    THEN ARRAY['Leitura crítica e certeza da evidência', 'Revisões sistemáticas']
  WHEN 'Leitura crítica e certeza da evidência e risco de viés e revisão sistemática'
    THEN ARRAY['Leitura crítica e certeza da evidência', 'Risco de viés', 'Revisões sistemáticas']
  WHEN 'Revisões sistemáticas e risco de viés'
    THEN ARRAY['Revisões sistemáticas', 'Risco de viés']
  ELSE ARRAY["category"]
END
WHERE "category" IS NOT NULL
  AND btrim("category") <> ''
  AND cardinality("categories") = 0;

-- A categoria principal passa a ser a primeira da lista.
UPDATE "LibraryItem"
SET "category" = "categories"[1]
WHERE cardinality("categories") > 0
  AND "category" IS DISTINCT FROM "categories"[1];

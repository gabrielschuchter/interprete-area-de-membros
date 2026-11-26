-- Nomes canônicos nas categorias da Biblioteca (só dados).
-- "Relato e ciência aberta" passa a se chamar "Relato", e os apelidos antigos
-- gravados em "categories" viram o nome do grupo, sem repetir e na mesma ordem.
-- Rollback: valores anteriores em "LibraryItemCategoryBackup20261126b".
WITH alias_map(alias, canon) AS (
  VALUES
    ('Fundamentos de EBM', 'Fundamentos da PBE'),
    ('Fundamentos e perguntas clínicas', 'Fundamentos da PBE'),
    ('Busca bibliográfica', 'Busca da evidência'),
    ('Protocolos e registro', 'Registros de protocolo'),
    ('Revisões sistemáticas e meta-análises', 'Revisões sistemáticas'),
    ('Leitura crítica e risco de viés', 'Leitura crítica e certeza da evidência'),
    ('Certeza da evidência e GRADE', 'Leitura crítica e certeza da evidência'),
    ('GRADE', 'Leitura crítica e certeza da evidência'),
    ('Relato e ciência aberta', 'Relato'),
    ('Relato científico', 'Relato'),
    ('Reporting guidelines', 'Relato'),
    ('Ciência aberta e reprodutibilidade', 'Relato'),
    ('Epidemiologia clínica', 'Epidemiologia e desenhos de estudo'),
    ('Causalidade', 'Epidemiologia e desenhos de estudo'),
    ('Diagnóstico e prognóstico', 'Epidemiologia e desenhos de estudo'),
    ('Evidence-Based Nutrition', 'Nutrição baseada em evidências'),
    ('Bioestatística', 'Bioestatística e interpretação')
),
rebuilt AS (
  SELECT id, array_agg(v ORDER BY first_ord) AS cats
  FROM (
    SELECT id, v, min(ord) AS first_ord
    FROM (
      SELECT l.id, coalesce(m.canon, u.c) AS v, u.ord
      FROM "LibraryItem" l
      CROSS JOIN LATERAL unnest(l."categories") WITH ORDINALITY AS u(c, ord)
      LEFT JOIN alias_map m ON m.alias = u.c
    ) x
    GROUP BY id, v
  ) y
  GROUP BY id
)
UPDATE "LibraryItem" li
SET "categories" = rebuilt.cats
FROM rebuilt
WHERE li.id = rebuilt.id
  AND li."categories" IS DISTINCT FROM rebuilt.cats;

UPDATE "LibraryItem"
SET "category" = "categories"[1]
WHERE cardinality("categories") > 0
  AND "category" IS DISTINCT FROM "categories"[1];

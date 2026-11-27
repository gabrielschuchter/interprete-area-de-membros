-- Temas da lista (tags dos cadernos), cadastrados pelo professor.
ALTER TABLE "ExerciseList"
  ADD COLUMN "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Aproveita as descrições que já seguem "… sobre tema, tema e tema." (só a
-- primeira frase vale; o que vem depois do primeiro ponto é explicação).
UPDATE "ExerciseList"
SET "topics" = ARRAY(
  SELECT btrim(topic)
  FROM unnest(
    regexp_split_to_array(
      regexp_replace(
        regexp_replace("description", '^.*?\msobre\s+', '', 'i'),
        '[.…].*$',
        ''
      ),
      '\s*,\s*|\s+e\s+'
    )
  ) AS topic
  WHERE btrim(topic) <> ''
)
WHERE "description" ~* '\msobre\s+';

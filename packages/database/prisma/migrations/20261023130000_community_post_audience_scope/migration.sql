-- A nullable group FK cannot prove that a post was created globally: ON DELETE
-- SET NULL previously erased that distinction. Keep ambiguous legacy rows
-- inaccessible until their origin is verified, and require explicit scope for
-- all new writers.
ALTER TABLE public."CommunityPost"
  ADD COLUMN "audienceScope" VARCHAR(16) NOT NULL DEFAULT 'UNRESOLVED';

UPDATE public."CommunityPost"
SET "audienceScope" = 'GROUP'
WHERE "spaceId" IS NOT NULL;

ALTER TABLE public."CommunityPost"
  ADD CONSTRAINT "CommunityPost_audienceScope_check"
  CHECK (
    "audienceScope" = 'UNRESOLVED'
    OR ("audienceScope" = 'GLOBAL' AND "spaceId" IS NULL)
    OR ("audienceScope" = 'GROUP' AND "spaceId" IS NOT NULL)
  );

-- Group removal is an archive operation. Physical deletion must not detach
-- posts and accidentally make them look global to older readers.
ALTER TABLE public."CommunityPost"
  DROP CONSTRAINT "CommunityPost_spaceId_fkey";

ALTER TABLE public."CommunityPost"
  ADD CONSTRAINT "CommunityPost_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES public."CommunitySpace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

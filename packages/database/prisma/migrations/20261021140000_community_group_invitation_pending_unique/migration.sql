-- Keep exactly one active personal invitation per group/member pair while
-- retaining any older duplicate as a revoked history row.
WITH ranked_pending AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "spaceId", "inviteeId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS position
  FROM "CommunitySpaceInvitation"
  WHERE "status" = 'PENDING'
)
UPDATE "CommunitySpaceInvitation" AS invitation
SET "status" = 'REVOKED',
    "respondedAt" = COALESCE(invitation."respondedAt", NOW())
FROM ranked_pending
WHERE invitation."id" = ranked_pending."id"
  AND ranked_pending.position > 1;

CREATE UNIQUE INDEX "CommunitySpaceInvitation_one_pending_per_invitee"
  ON "CommunitySpaceInvitation"("spaceId", "inviteeId")
  WHERE "status" = 'PENDING';

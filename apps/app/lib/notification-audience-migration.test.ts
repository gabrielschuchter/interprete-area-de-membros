import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../packages/database/prisma/migrations/20261023120000_notification_community_audience_fail_closed/migration.sql"
  ),
  "utf8"
);
const schema = readFileSync(
  resolve(process.cwd(), "../../packages/database/prisma/schema.prisma"),
  "utf8"
);
const communityScopeDefaultPattern =
  /communitySpaceId String\?\s+@default\("__community_scope_unresolved__"\)/;

test("legacy notification writers receive an unresolved scope by default", () => {
  expect(migration).toContain(
    `ALTER COLUMN "communitySpaceId"\n    SET DEFAULT '__community_scope_unresolved__'`
  );
  expect(schema).toMatch(communityScopeDefaultPattern);
});

test("legacy null community notifications fail closed before live-link recovery", () => {
  const failClosedUpdate = migration.indexOf(
    `SET "communitySpaceId" = '__community_scope_unresolved__'\nWHERE "communitySpaceId" IS NULL`
  );
  const commentTypeClause = migration.indexOf(
    `AND notification."type" IN (\n      'MENTION',\n      'COMMENT_REPLY',\n      'TOPIC_COMMENT',\n      'FOLLOWED_TOPIC_ACTIVITY'`
  );
  const commentRecovery = migration.lastIndexOf(
    `UPDATE public."Notification" AS notification`,
    commentTypeClause
  );
  const followingUpdate = migration.indexOf(
    `UPDATE public."Notification" AS notification`,
    commentRecovery + 1
  );
  const commentBackfill = migration.slice(
    commentRecovery,
    followingUpdate < 0 ? migration.length : followingUpdate
  );

  expect(failClosedUpdate).toBeGreaterThanOrEqual(0);
  expect(commentRecovery).toBeGreaterThan(failClosedUpdate);
  expect(commentBackfill).toContain(`AND post."spaceId" IS NOT NULL`);
});

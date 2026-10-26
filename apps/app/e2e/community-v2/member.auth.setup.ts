import { test } from "@playwright/test";
import { memberStatePath, prepareClerkStorageState } from "./auth-state";

test("reuse or initialize the existing Clerk Development member session", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await prepareClerkStorageState({
    context,
    emailAddress: process.env.COMMUNITY_QA_MEMBER_EMAIL,
    expectedUserId: process.env.COMMUNITY_QA_MEMBER_ID,
    page,
    storageStatePath: memberStatePath,
  });
});

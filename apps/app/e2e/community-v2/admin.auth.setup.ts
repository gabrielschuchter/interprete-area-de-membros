import { test } from "@playwright/test";
import { adminStatePath, prepareClerkStorageState } from "./auth-state";

test("reuse or initialize the existing Clerk Development admin session", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await prepareClerkStorageState({
    context,
    emailAddress: process.env.COMMUNITY_QA_ADMIN_EMAIL,
    page,
    storageStatePath: adminStatePath,
  });
});

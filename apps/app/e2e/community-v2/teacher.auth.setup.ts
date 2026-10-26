import { test } from "@playwright/test";
import { prepareClerkStorageState, teacherStatePath } from "./auth-state";

test("reuse or initialize the existing Clerk Development teacher session", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await prepareClerkStorageState({
    context,
    emailAddress: process.env.COMMUNITY_QA_TEACHER_EMAIL,
    expectedUserId: process.env.COMMUNITY_QA_TEACHER_ID,
    page,
    storageStatePath: teacherStatePath,
  });
});

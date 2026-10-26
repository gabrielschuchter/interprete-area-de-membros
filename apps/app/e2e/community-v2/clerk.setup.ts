import { clerkSetup } from "@clerk/testing/playwright";
import { test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("initialize Clerk Testing token for this Playwright run", async () => {
  await clerkSetup();
});

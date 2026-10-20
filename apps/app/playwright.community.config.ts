import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const authDirectory =
  process.env.COMMUNITY_QA_AUTH_DIR ??
  resolve(
    process.env.LOCALAPPDATA ?? process.env.TEMP ?? ".",
    "Codex/qa/community-v2-foundation-20261015/playwright"
  );
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", process.env.COMMUNITY_QA_RUN_ID ?? "local");
const memberState = resolve(authDirectory, "community-v2-member.json");
const adminState = resolve(authDirectory, "community-v2-admin.json");
const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";

const localUse = {
  baseURL,
  browserName: "chromium" as const,
  channel: "msedge" as const,
  headless: true,
  screenshot: "only-on-failure" as const,
  trace: "retain-on-failure" as const,
};

export default defineConfig({
  globalSetup: "./e2e/community-v2/global-setup.ts",
  outputDir: outputDirectory,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  testDir: "./e2e/community-v2",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: localUse,
  projects: [
    {
      name: "member-auth",
      testMatch: /member\.auth\.setup\.ts$/,
      use: { ...localUse, storageState: memberState },
    },
    {
      name: "admin-auth",
      testMatch: /admin\.auth\.setup\.ts$/,
      use: { ...localUse, storageState: adminState },
    },
    {
      name: "community-member",
      testMatch: /member-flow\.spec\.ts$/,
      dependencies: ["member-auth"],
      use: { ...localUse, storageState: memberState },
    },
    {
      name: "community-admin-recovery",
      testMatch: /admin-recovery\.spec\.ts$/,
      dependencies: ["admin-auth", "community-member"],
      use: { ...localUse, storageState: adminState },
    },
    {
      name: "community-member-recovery",
      testMatch: /member-recovery\.spec\.ts$/,
      dependencies: ["community-admin-recovery"],
      use: { ...localUse, storageState: memberState },
    },
  ],
  webServer: {
    command:
      "node scripts/run-next-with-system-ca.mjs dev --hostname localhost -p 3101",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      COMMUNITY_POST_COVER_ALT_ENABLED: "true",
      NEXT_PUBLIC_APP_URL: baseURL,
      NODE_USE_SYSTEM_CA: "1",
    },
  },
});

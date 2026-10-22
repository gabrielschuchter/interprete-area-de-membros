import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import {
  adminStatePath,
  authDirectory,
  memberStatePath,
  secondaryMemberStatePath,
} from "./e2e/community-v2/auth-state-paths";

const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", process.env.COMMUNITY_QA_RUN_ID ?? "local");
const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";
const webServerUrl = new URL("/sign-in?redirect_url=%2F", baseURL).toString();

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
      testMatch: /(^|[\\/])member\.auth\.setup\.ts$/,
      use: { ...localUse, storageState: memberStatePath },
    },
    {
      name: "admin-auth",
      testMatch: /(^|[\\/])admin\.auth\.setup\.ts$/,
      use: { ...localUse, storageState: adminStatePath },
    },
    {
      name: "secondary-member-auth",
      testMatch: /(^|[\\/])secondary-member\.auth\.setup\.ts$/,
      use: localUse,
    },
    {
      name: "teacher-auth",
      testMatch: /(^|[\\/])teacher\.auth\.setup\.ts$/,
      use: localUse,
    },
    {
      name: "community-member",
      testMatch: /member-flow\.spec\.ts$/,
      dependencies: ["member-auth"],
      use: { ...localUse, storageState: memberStatePath },
    },
    {
      name: "community-admin-recovery",
      testMatch: /admin-recovery\.spec\.ts$/,
      dependencies: ["admin-auth", "community-member"],
      use: { ...localUse, storageState: adminStatePath },
    },
    {
      name: "community-member-recovery",
      testMatch: /member-recovery\.spec\.ts$/,
      dependencies: ["community-admin-recovery"],
      use: { ...localUse, storageState: memberStatePath },
    },
    {
      name: "community-storage-cover",
      testMatch: /storage-cover\.spec\.ts$/,
      dependencies: ["member-auth", "admin-auth"],
      use: { ...localUse, storageState: memberStatePath },
    },
    {
      name: "community-discussion",
      testMatch: /discussion\.spec\.ts$/,
      dependencies: ["member-auth", "admin-auth"],
      use: { ...localUse, storageState: memberStatePath },
    },
    {
      name: "community-groups",
      testMatch: /community-groups\.spec\.ts$/,
      dependencies: [
        "member-auth",
        "secondary-member-auth",
        "teacher-auth",
        "admin-auth",
      ],
      use: { ...localUse, storageState: secondaryMemberStatePath },
    },
    {
      name: "community-invitations",
      testMatch: /community-invitations\.spec\.ts$/,
      dependencies: [
        "member-auth",
        "secondary-member-auth",
        "teacher-auth",
        "admin-auth",
      ],
      use: { ...localUse, storageState: secondaryMemberStatePath },
    },
    {
      name: "community-shares",
      testMatch: /community-shares\.spec\.ts$/,
      dependencies: [
        "member-auth",
        "secondary-member-auth",
        "teacher-auth",
        "admin-auth",
      ],
      use: { ...localUse, storageState: secondaryMemberStatePath },
    },
  ],
  webServer: {
    command:
      "node scripts/run-next-with-system-ca.mjs dev --hostname localhost -p 3101",
    url: webServerUrl,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      COMMUNITY_POST_COVER_ALT_ENABLED: "true",
      APP_WRITE_FREEZE: "false",
      UPLOADS_PAUSED_FOR_ROLLBACK: "false",
      NEXT_PUBLIC_APP_URL: baseURL,
      NODE_USE_SYSTEM_CA: "1",
    },
  },
});

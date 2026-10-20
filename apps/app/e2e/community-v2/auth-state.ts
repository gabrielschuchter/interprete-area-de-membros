import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { type BrowserContext, expect, type Page } from "@playwright/test";

const authDirectory =
  process.env.COMMUNITY_QA_AUTH_DIR ??
  resolve(
    process.env.LOCALAPPDATA ?? process.env.TEMP ?? ".",
    "Codex/qa/community-v2-foundation-20261015/playwright"
  );

export const memberStatePath = resolve(
  authDirectory,
  "community-v2-member-local.json"
);
export const adminStatePath = resolve(authDirectory, "community-v2-admin.json");

export async function prepareClerkStorageState({
  context,
  emailAddress,
  page,
  storageStatePath,
}: {
  readonly context: BrowserContext;
  readonly emailAddress: string | undefined;
  readonly page: Page;
  readonly storageStatePath: string;
}) {
  if (!emailAddress) {
    throw new Error(
      "Local QA account configuration is missing; run scripts/community-v2/run-local-qa.ps1."
    );
  }

  await page.goto("/comunidade/minhas-publicacoes");
  const authenticated = await page
    .getByRole("heading", { name: "Minhas publicações" })
    .isVisible()
    .catch(() => false);

  if (!authenticated) {
    await page.goto("/sign-in");
    await clerk.loaded({ page });
    await clerk.signIn({ emailAddress, page });
    await page.goto("/comunidade/minhas-publicacoes");
  }

  await expect(
    page.getByRole("heading", { name: "Minhas publicações" })
  ).toBeVisible();
  await mkdir(dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath, indexedDB: true });
}

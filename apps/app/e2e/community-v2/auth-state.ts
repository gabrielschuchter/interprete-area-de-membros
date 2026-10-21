import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { type BrowserContext, expect, type Page } from "@playwright/test";

export {
  adminStatePath,
  memberStatePath,
  secondaryMemberStatePath,
  teacherStatePath,
} from "./auth-state-paths";

export const clerkUserId = async (page: Page) => {
  const sessionCookie = (await page.context().cookies(page.url())).find(
    (cookie) => cookie.name === "__session"
  );
  const payload = sessionCookie?.value.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { readonly sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
};

export async function prepareClerkStorageState({
  context,
  emailAddress,
  expectedUserId,
  page,
  storageStatePath,
}: {
  readonly context: BrowserContext;
  readonly emailAddress: string | undefined;
  readonly expectedUserId: string | undefined;
  readonly page: Page;
  readonly storageStatePath: string;
}) {
  if (!emailAddress) {
    throw new Error(
      "Local QA account configuration is missing; run scripts/community-v2/run-local-qa.ps1."
    );
  }

  if (!expectedUserId) {
    throw new Error(
      "Local QA account ID is missing; run scripts/community-v2/run-local-qa.ps1."
    );
  }

  await page.goto("/comunidade/minhas-publicacoes");
  let authenticated = await page
    .getByRole("heading", { name: "Minhas publicações" })
    .isVisible()
    .catch(() => false);

  if (authenticated) {
    await clerk.loaded({ page });
    authenticated = (await clerkUserId(page)) === expectedUserId;
  }

  if (!authenticated) {
    await page.evaluate(async () => {
      const clerkWindow = window as typeof window & {
        Clerk?: { signOut: () => Promise<void> };
      };
      await clerkWindow.Clerk?.signOut();
    });
    await page.goto("/sign-in");
    await clerk.loaded({ page });
    await clerk.signIn({ emailAddress, page });
    await page.goto("/comunidade/minhas-publicacoes");
  }

  await expect(
    page.getByRole("heading", { name: "Minhas publicações" })
  ).toBeVisible();
  expect(await clerkUserId(page)).toBe(expectedUserId);
  await mkdir(dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath, indexedDB: true });
}

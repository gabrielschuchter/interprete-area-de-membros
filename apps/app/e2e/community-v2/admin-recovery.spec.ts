import { expect, test } from "@playwright/test";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";

const recoveryTitle = `Comunidade ${runId} recuperação`;
const adminCommunityPath = /\/admin\/community$/;

test("staff can recover a soft-deleted publication inside the 30-day window", async ({
  page,
}) => {
  if (runId === "missing-run-id") {
    throw new Error("Run the guarded local Community V2 QA script first.");
  }
  await page.goto("/admin/community");
  await expect(
    page.getByRole("heading", { name: "Publicações excluídas" })
  ).toBeVisible();

  const recoverySection = page.getByRole("region", {
    name: "Publicações excluídas",
  });
  const deletedPost = recoverySection
    .locator("article")
    .filter({ hasText: recoveryTitle })
    .first();
  await expect(deletedPost).toBeVisible();
  await deletedPost.getByRole("button", { name: "Recuperar" }).click();
  await expect(page).toHaveURL(adminCommunityPath);
  await expect(recoverySection.getByText(recoveryTitle)).toHaveCount(0);
});

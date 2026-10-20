import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";

const recoveryTitle = `Comunidade ${runId} recuperação`;
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(
    process.env.LOCALAPPDATA ?? process.env.TEMP ?? ".",
    "Codex/qa/community-v2-foundation-20261015/playwright/results/local"
  );

test("the author sees the restored draft once in My Publications", async ({
  page,
}) => {
  if (runId === "missing-run-id") {
    throw new Error("Run the guarded local Community V2 QA script first.");
  }
  await page.goto(
    `/comunidade/minhas-publicacoes?status=drafts&q=${encodeURIComponent(runId)}`
  );
  const restoredDraft = page.getByRole("link", {
    name: recoveryTitle,
    exact: true,
  });
  await expect(restoredDraft).toHaveCount(1);
  await expect(restoredDraft).toBeVisible();
  await expect(
    page.getByText(`Rascunho removido para recuperação ${runId}`)
  ).toBeVisible();

  await mkdir(outputDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: resolve(outputDirectory, "community-my-publications-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", {
      name: "Visão da comunidade: Minhas publicações",
    })
  ).toBeVisible();
  await expect(
    page.getByLabel("Situação das publicações em dispositivos móveis")
  ).toBeVisible();
  await page.screenshot({
    path: resolve(outputDirectory, "community-my-publications-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";

const draftTitle = `Comunidade ${runId} publicação`;
const editedTitle = `Comunidade ${runId} publicação editada`;
const recoveryTitle = `Comunidade ${runId} recuperação`;
const firstBody = `Conteúdo persistente ${runId}`;
const editedBody = `Conteúdo editado e persistido ${runId}`;
const returnTo = "/comunidade/minhas-publicacoes?status=drafts";
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(
    process.env.LOCALAPPDATA ?? process.env.TEMP ?? ".",
    "Codex/qa/community-v2-foundation-20261015/playwright/results/local"
  );
const newComposerButtonName = /Escreva uma publicação/;
const newComposerPath = /\/comunidade\/novo\?/;
const savedEditorPath = /\/comunidade\/editor\/[A-Za-z0-9_-]+\?/;
const publicationPath = /\/comunidade\/publicacoes\//;
const editorPath = /\/comunidade\/editor\//;
const archivedPublicationsPath = /status=archived/;
const communityHomePath = /\/comunidade(?:\?.*)?$/;
const deletedPostUndoPath = /undoPost=/;

async function saveDraft(
  page: import("@playwright/test").Page,
  title: string,
  body: string
) {
  await page.goto("/comunidade");
  await page.getByRole("button", { name: newComposerButtonName }).click();
  await expect(page).toHaveURL(newComposerPath);
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Conteúdo da publicação" })
    .fill(body);
  await expect(
    page.getByText("Rascunho salvo · visível só para você")
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(savedEditorPath);
}

async function deleteFromPublicationCard(
  page: import("@playwright/test").Page,
  title: string,
  expectedDialogTitle: string
) {
  const card = page.locator("article").filter({ hasText: title }).first();
  await card.getByRole("button", { name: "Ações da publicação" }).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("heading", { name: expectedDialogTitle })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
}

test("creates once, autosaves, publishes, edits, archives, deletes and undoes", async ({
  page,
}) => {
  if (runId === "missing-run-id") {
    throw new Error("Run the guarded local Community V2 QA script first.");
  }
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/comunidade");

  // Opening and leaving the editor without input must not create a blank row.
  await page.getByRole("button", { name: newComposerButtonName }).click();
  await expect(page).toHaveURL(newComposerPath);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(communityHomePath);
  await page.goto(returnTo);
  await page
    .getByRole("searchbox", { name: "Buscar nos meus rascunhos" })
    .fill(runId);
  await page
    .getByRole("searchbox", { name: "Buscar nos meus rascunhos" })
    .press("Enter");
  await expect(
    page.getByText("Nenhuma publicação encontrada com esse termo.")
  ).toBeVisible();

  await saveDraft(page, draftTitle, firstBody);
  const editorUrl = page.url();
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill(editedTitle);
  await expect(
    page.getByText("Rascunho salvo · visível só para você")
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(editorUrl);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true })
  ).toHaveValue(editedTitle);
  await expect(
    page.getByRole("textbox", { name: "Conteúdo da publicação" })
  ).toContainText(firstBody);

  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(outputDirectory, "community-editor-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(outputDirectory, "community-editor-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(publicationPath, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();

  const editedQuery = new URLSearchParams({
    status: "published",
    q: editedTitle,
  }).toString();
  await page.goto(`/comunidade/minhas-publicacoes?${editedQuery}`);
  const publishedCard = page
    .locator("article")
    .filter({ hasText: editedTitle })
    .first();
  await expect(publishedCard).toBeVisible();
  await publishedCard
    .getByRole("button", { name: "Ações da publicação" })
    .click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await expect(page).toHaveURL(editorPath);
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill(editedTitle);
  await page
    .getByRole("textbox", { name: "Conteúdo da publicação" })
    .fill(editedBody);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Edição publicada")).toBeVisible();

  await page.goto(`/comunidade/minhas-publicacoes?${editedQuery}`);
  const updatedCard = page
    .locator("article")
    .filter({ hasText: editedTitle })
    .first();
  await updatedCard
    .getByRole("button", { name: "Ações da publicação" })
    .click();
  await page.getByRole("menuitem", { name: "Arquivar" }).click();
  await expect(page).toHaveURL(archivedPublicationsPath);
  const archivedCard = page
    .locator("article")
    .filter({ hasText: editedTitle })
    .first();
  await expect(archivedCard).toBeVisible();
  await archivedCard.getByRole("button", { name: "Restaurar" }).click();
  await expect(page).toHaveURL(publicationPath, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();

  await page.goto(`/comunidade/minhas-publicacoes?${editedQuery}`);
  const restoredCard = page
    .locator("article")
    .filter({ hasText: editedTitle })
    .first();
  await restoredCard
    .getByRole("button", { name: "Ações da publicação" })
    .click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(
    deleteDialog.getByRole("heading", { name: "Excluir publicação?" })
  ).toBeVisible();
  await deleteDialog
    .getByRole("button", { name: "Excluir", exact: true })
    .click();
  await expect(
    page.getByRole("status").getByText("Publicação excluída.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(
    page.locator("article").filter({ hasText: editedTitle })
  ).toBeVisible();

  await page.goto(returnTo);
  await saveDraft(
    page,
    recoveryTitle,
    `Rascunho removido para recuperação ${runId}`
  );
  await page.goto(
    `/comunidade/minhas-publicacoes?status=drafts&q=${encodeURIComponent(runId)}`
  );
  await expect(
    page.getByRole("link", { name: recoveryTitle, exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByText(`Rascunho removido para recuperação ${runId}`)
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Situação das publicações" })
  ).toBeHidden();
  await expect(
    page.getByLabel("Situação das publicações em dispositivos móveis")
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Visão da comunidade: Minhas publicações",
    })
  ).toBeVisible();
  await page.screenshot({
    path: resolve(outputDirectory, "community-my-publications-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: resolve(outputDirectory, "community-my-publications-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await deleteFromPublicationCard(page, recoveryTitle, "Excluir rascunho?");
  await expect(page).toHaveURL(deletedPostUndoPath);
  await expect(
    page.getByRole("status").getByText("Publicação excluída.")
  ).toBeVisible();
});

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { clerkUserId } from "./auth-state";
import { adminStatePath, authDirectory } from "./auth-state-paths";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", runId);
const publicationPath = /\/comunidade\/publicacoes\//;
const newPublicationButtonName = /Escreva uma publicação/;
const groupConfirmationName = /notificar um grupo/;
const replyContextPattern = /Respondendo a/;
const commentLauncherName = /Escreva um comentário/;

test("lê e mantém uma discussão, respostas, menções e acompanhamento", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  const previewRecipientIds = new Set(
    (process.env.OUTBOX_PREVIEW_MEMBER_IDS ?? "").split(",").filter(Boolean)
  );
  const memberId = process.env.COMMUNITY_QA_MEMBER_ID;
  const adminId = process.env.COMMUNITY_QA_ADMIN_ID;
  if (
    runId === "missing-run-id" ||
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    process.env.VERCEL_ENV !== "preview" ||
    process.env.OUTBOX_QUEUE_NAMESPACE !== "preview" ||
    !memberId ||
    !adminId ||
    !previewRecipientIds.has(memberId) ||
    !previewRecipientIds.has(adminId)
  ) {
    throw new Error(
      "Run the guarded local Community V2 discussion QA with its Preview outbox allowlist first."
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/comunidade");
  await clerk.loaded({ page });
  expect(await clerkUserId(page)).toBe(memberId);

  const title = `Discussão QA ${runId}`;
  await page.getByRole("button", { name: newPublicationButtonName }).click();
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Conteúdo da publicação" })
    .fill(`Texto usado para validar a conversa real ${runId}.`);
  await expect(
    page.getByText("Rascunho salvo · visível só para você")
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(publicationPath, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const postId = await page
    .locator(".community-comment-composer input[name=postId]")
    .inputValue();
  const publicationUrl = page.url();
  const memberMentionCandidates = await page.evaluate(async (id) => {
    const response = await fetch(
      `/api/members/search?postId=${encodeURIComponent(id)}&q=todos`,
      { cache: "no-store" }
    );
    return (await response.json()) as { groups?: Array<{ id: string }> };
  }, postId);
  expect(memberMentionCandidates.groups).toEqual([]);

  const originalComment = `Comentário de leitura ${runId}`;
  const editedComment = `Comentário revisado ${runId}`;
  const commentInput = page.getByRole("textbox", { name: "Comentário" });
  await expect(page.getByRole("button", { name: "Comentar" })).toBeDisabled();
  await commentInput.fill(originalComment);
  await page.getByRole("button", { name: "Comentar" }).click();
  await expect(page.getByText("Comentário publicado")).toBeVisible();
  await expect(
    page.locator(".community-comment__content").filter({
      hasText: originalComment,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Silenciar discussão" })
  ).toBeVisible();

  const comment = page
    .locator(".community-comment--top-level")
    .filter({ hasText: originalComment });
  await comment.locator(".community-comment__options > summary").click();
  await comment.getByRole("menuitem", { name: "Editar" }).click();
  await comment.getByRole("textbox").last().fill(editedComment);
  await comment.getByRole("button", { name: "Salvar edição" }).click();
  await expect(
    page.locator(".community-comment__content").filter({
      hasText: editedComment,
    })
  ).toBeVisible();

  const adminContext = await browser.newContext({
    storageState: adminStatePath,
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const adminPage = await adminContext.newPage();
    await adminPage.goto(publicationUrl);
    await clerk.loaded({ page: adminPage });
    expect(await clerkUserId(adminPage)).toBe(adminId);
    await expect(
      adminPage.locator(".community-comment__content").filter({
        hasText: editedComment,
      })
    ).toBeVisible();

    const adminCandidates = await adminPage.evaluate(async (id) => {
      const response = await fetch(
        `/api/members/search?postId=${encodeURIComponent(id)}&q=todos`,
        { cache: "no-store" }
      );
      return (await response.json()) as {
        groups?: Array<{ id: string; recipientCount: number }>;
      };
    }, postId);
    expect(adminCandidates.groups).toContainEqual(
      expect.objectContaining({ id: "group:ALL", recipientCount: 1 })
    );
    expect(
      adminCandidates.groups?.find(({ id }) => id === "group:ALL")
    ).toEqual(expect.objectContaining({ recipientCount: 1 }));

    const adminCommentInput = adminPage.getByRole("textbox", {
      name: "Comentário",
    });
    await adminCommentInput.fill("@todos");
    const everyoneOption = adminPage
      .getByRole("option")
      .filter({ hasText: "Todos nesta discussão" });
    await expect(everyoneOption).toBeVisible();
    await adminPage.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await adminPage.screenshot({
      path: resolve(outputDirectory, "community-mention-desktop.png"),
      animations: "disabled",
    });
    await everyoneOption.click();
    await adminCommentInput.fill(`@todos Aviso QA ${runId}`);
    await adminPage
      .getByRole("checkbox", { name: groupConfirmationName })
      .check();
    await adminPage.getByRole("button", { name: "Comentar" }).click();
    await expect(adminPage.getByText("Comentário publicado")).toBeVisible();
    await expect(
      adminPage.locator(".community-comment__content").filter({
        hasText: `Aviso QA ${runId}`,
      })
    ).toBeVisible();
    await expect(
      adminPage.getByRole("button", { name: "Silenciar discussão" })
    ).toBeVisible();

    const memberComment = adminPage
      .locator(".community-comment--top-level")
      .filter({ hasText: editedComment });
    await memberComment.getByRole("button", { name: "Responder" }).click();
    const replyDialog = adminPage.getByRole("dialog", { name: "Responder" });
    await expect(replyDialog.getByText(replyContextPattern)).toBeVisible();
    await replyDialog
      .getByRole("textbox", { name: "Sua resposta" })
      .fill(`Resposta de um nível ${runId}`);
    await replyDialog.getByRole("button", { name: "Comentar" }).click();
    await expect(
      adminPage.getByText(`Resposta de um nível ${runId}`)
    ).toBeVisible();
    const reply = adminPage
      .locator(".community-comment--reply")
      .filter({ hasText: `Resposta de um nível ${runId}` });
    await expect(reply.getByRole("button", { name: "Responder" })).toHaveCount(
      0
    );

    await adminPage
      .getByRole("button", { name: "Silenciar discussão" })
      .click();
    await expect(
      adminPage.getByRole("button", {
        name: "Ativar notificações da discussão",
      })
    ).toBeVisible();
    await adminPage.reload();
    await adminPage.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await expect(
      adminPage.getByRole("button", {
        name: "Ativar notificações da discussão",
      })
    ).toBeVisible();

    await adminPage.setViewportSize({ width: 390, height: 844 });
    await adminPage.evaluate(() => window.scrollTo(0, 0));
    await adminPage.screenshot({
      path: resolve(outputDirectory, "community-discussion-mobile.png"),
      animations: "disabled",
    });
    const commentLauncher = adminPage.getByRole("button", {
      name: commentLauncherName,
    });
    await adminPage.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await adminPage.waitForFunction(
      () =>
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight
    );
    await expect(commentLauncher).toBeInViewport();
    const launcherBounds = await commentLauncher.boundingBox();
    expect(launcherBounds).not.toBeNull();
    expect(launcherBounds?.y).toBeGreaterThanOrEqual(0);
    expect(
      (launcherBounds?.y ?? 0) + (launcherBounds?.height ?? 0)
    ).toBeLessThanOrEqual(844);
    await adminPage.screenshot({
      path: resolve(
        outputDirectory,
        "community-discussion-mobile-launcher.png"
      ),
      animations: "disabled",
    });
    await commentLauncher.click();
    const mobileCommentDialog = adminPage.getByRole("dialog", {
      name: "Comentar publicação",
    });
    await expect(mobileCommentDialog).toBeVisible();
    await mobileCommentDialog
      .getByRole("textbox", { name: "Sua contribuição" })
      .fill("@");
    await expect(
      mobileCommentDialog.getByRole("listbox").getByRole("option").first()
    ).toBeVisible();
    await adminPage.screenshot({
      path: resolve(outputDirectory, "community-mention-mobile.png"),
      animations: "disabled",
    });
    await mobileCommentDialog
      .getByRole("button", { name: "Fechar composição" })
      .click();

    await memberComment.getByRole("button", { name: "Responder" }).click();
    const mobileReplyDialog = adminPage.getByRole("dialog", {
      name: "Responder",
    });
    await expect(
      mobileReplyDialog.getByText(`Comentário revisado ${runId}`)
    ).toBeVisible();
    await mobileReplyDialog
      .getByRole("textbox", { name: "Sua resposta" })
      .fill("@");
    await expect(
      mobileReplyDialog.getByRole("listbox").getByRole("option").first()
    ).toBeVisible();
    await adminPage.screenshot({
      path: resolve(outputDirectory, "community-reply-mobile.png"),
      animations: "disabled",
    });
    await mobileReplyDialog
      .getByRole("button", { name: "Fechar composição" })
      .click();
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
    await adminPage.evaluate(() => window.scrollTo(0, 0));
    await adminPage.screenshot({
      path: resolve(outputDirectory, "community-discussion-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    const commentOptions = memberComment
      .locator(":scope > .community-comment__controls")
      .locator(".community-comment__options");
    const memberCommentId = await memberComment.getAttribute("id");
    expect(memberCommentId).toBeTruthy();
    await commentOptions.locator(":scope > summary").click();
    await commentOptions.getByRole("menuitem", { name: "Apagar" }).click();
    await expect(
      adminPage
        .locator(`[id="${memberCommentId}"]`)
        .getByText("Comentário removido")
    ).toBeVisible();
  } finally {
    await adminContext.close();
  }
});

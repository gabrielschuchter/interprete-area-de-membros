import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  expect,
  type Locator,
  type Page,
  request as playwrightRequest,
  test,
} from "@playwright/test";
import { clerkUserId } from "./auth-state";
import { adminStatePath, authDirectory } from "./auth-state-paths";

interface ClerkQaAccount {
  readonly clerkUserId: string;
  readonly email: string;
  readonly role: string;
}

interface StorageListItem {
  readonly name?: string;
}

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", runId);
const editorTitle = `Capa Storage QA ${runId}`;
const originalAlt = `Capa persistida ${runId}`;
const replacementAlt = `Capa substituída ${runId}`;
const storageUrl = process.env.SUPABASE_URL ?? "";
const storageSecret =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "";
const storageAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "";
const trailingSlashPattern = /\/$/;
const emptyStorageState = { cookies: [], origins: [] };
const newPublicationButtonName = /Escreva uma publicação/;
const newComposerUrlPattern = /\/comunidade\/novo\?/;
const editorUrlPattern = /\/comunidade\/editor\//;
const communityHomeUrlPattern = /\/comunidade(?:\?.*)?$/;
const publishedPostUrlPattern = /\/comunidade\/publicacoes\//;
const coverObjectPathPattern = /^community-assets\/covers\/.+\.webp$/;

const assetUrl = (path: string) =>
  `/api/member-assets?path=${encodeURIComponent(path)}`;

const appAssetStatus = (
  page: Page,
  path: string,
  method: "GET" | "DELETE" = "GET"
) =>
  page.evaluate(
    async ({ assetPath, requestMethod }) => {
      const response = await fetch(
        `/api/member-assets?path=${encodeURIComponent(assetPath)}`,
        { cache: "no-store", method: requestMethod }
      );
      return response.status;
    },
    { assetPath: path, requestMethod: method }
  );

const storageObjectUrl = (path: string) =>
  `${storageUrl.replace(trailingSlashPattern, "")}/storage/v1/object/${encodeURIComponent(storageBucket)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const storageHeaders = (key: string) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
});

const readStoredObject = (path: string, key = storageSecret) =>
  fetch(storageObjectUrl(path), { headers: storageHeaders(key) });

const hasStoredObject = async (path: string) => {
  const segments = path.split("/");
  const name = segments.pop();
  if (!name) {
    return false;
  }
  const response = await fetch(
    `${storageUrl.replace(trailingSlashPattern, "")}/storage/v1/object/list/${encodeURIComponent(storageBucket)}`,
    {
      method: "POST",
      headers: {
        ...storageHeaders(storageSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 20,
        offset: 0,
        prefix: segments.join("/"),
        search: name,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Local Storage object listing failed (${response.status}).`
    );
  }
  const items = (await response.json()) as StorageListItem[];
  return items.some((item) => item.name === name || item.name === path);
};

const expectImageLoaded = async (image: Locator) => {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth)
    )
    .toBeGreaterThan(0);
};

test("uploads, persists, publishes, replaces and removes real private cover objects", async ({
  browser,
  page,
}) => {
  test.setTimeout(240_000);
  if (runId === "missing-run-id") {
    throw new Error(
      "Run scripts/community-v2/run-local-qa.ps1 -Suite storage-cover first."
    );
  }
  const parsedStorageUrl = new URL(storageUrl || "http://invalid.local");
  if (
    parsedStorageUrl.protocol !== "http:" ||
    parsedStorageUrl.hostname !== "127.0.0.1" ||
    parsedStorageUrl.port !== "54321" ||
    storageBucket !== "community-v2-cover-qa" ||
    !storageSecret ||
    !storageAnon
  ) {
    throw new Error(
      "Storage E2E requires the preflighted local Supabase project and credentials."
    );
  }

  const ledgerPath = process.env.COMMUNITY_QA_LEDGER_PATH;
  if (!ledgerPath) {
    throw new Error("The protected local Clerk QA ledger is unavailable.");
  }
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as {
    readonly accounts: readonly ClerkQaAccount[];
  };
  const otherMember = ledger.accounts.find(
    (account) =>
      account.role === "MEMBER" &&
      account.email !== process.env.COMMUNITY_QA_MEMBER_EMAIL
  );
  if (!otherMember) {
    throw new Error(
      "The existing second Clerk Development MEMBER identity is unavailable."
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/comunidade");
  await clerk.loaded({ page });
  expect(await clerkUserId(page)).toBe(process.env.COMMUNITY_QA_MEMBER_ID);
  await page.getByRole("button", { name: newPublicationButtonName }).click();
  await expect(page).toHaveURL(newComposerUrlPattern);
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill(editorTitle);
  await page
    .getByRole("textbox", { name: "Conteúdo da publicação" })
    .fill(`Publicação com capa validada no Supabase local ${runId}`);
  await expect(
    page.getByText("Rascunho salvo · visível só para você")
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(editorUrlPattern);
  const editorUrl = page.url();
  const coverInput = page.locator(
    ".community-editor-cover-controls input[type=file]"
  );
  const originalImage = resolve(
    process.cwd(),
    "public/brand/community/study-group.png"
  );
  const replacementImage = resolve(
    process.cwd(),
    "public/portal/mobile-comunidade-fc58e6afaa.webp"
  );

  // Fail the browser transport once, then recover through the actual app route.
  await page.route("**/api/member-assets", async (route) => {
    if (route.request().method() === "POST") {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await coverInput.setInputFiles(originalImage);
  await expect(
    page.getByText("Falha de conexão.", { exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: resolve(outputDirectory, "community-cover-error-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(outputDirectory, "community-cover-error-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.unroute("**/api/member-assets");

  // Hold the real POST briefly so the progress state can be captured.
  let releaseUpload: (() => void) | undefined;
  let signalUploadStarted: (() => void) | undefined;
  const uploadStarted = new Promise<void>((resolvePromise) => {
    signalUploadStarted = resolvePromise;
  });
  const continueUpload = new Promise<void>((resolvePromise) => {
    releaseUpload = resolvePromise;
  });
  let heldFirstUpload = false;
  await page.route("**/api/member-assets", async (route) => {
    if (route.request().method() === "POST" && !heldFirstUpload) {
      heldFirstUpload = true;
      signalUploadStarted?.();
      await continueUpload;
    }
    await route.continue();
  });
  const originalUploadResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/member-assets") &&
      response.request().method() === "POST"
  );
  await coverInput.setInputFiles(originalImage);
  await uploadStarted;
  try {
    await expect(page.getByRole("progressbar")).toBeVisible();
    await page.screenshot({
      path: resolve(outputDirectory, "community-cover-progress-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(outputDirectory, "community-cover-progress-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await page.setViewportSize({ width: 1440, height: 1000 });
    releaseUpload?.();
  }
  const originalUploadResponse = await originalUploadResponsePromise;
  await page.unroute("**/api/member-assets");
  expect(originalUploadResponse.ok()).toBe(true);
  const originalUpload = (await originalUploadResponse.json()) as {
    readonly path: string;
  };
  const originalPath = originalUpload.path;
  expect(originalPath).toMatch(coverObjectPathPattern);
  await expect(
    page.getByRole("textbox", { name: "Texto alternativo da capa" })
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Texto alternativo da capa" })
    .fill(originalAlt);
  await expect(
    page.getByText("Rascunho salvo · visível só para você")
  ).toBeVisible({ timeout: 20_000 });

  const originalStoredResponse = await readStoredObject(originalPath);
  expect(originalStoredResponse.ok).toBe(true);
  expect(originalStoredResponse.headers.get("content-type")).toContain(
    "image/webp"
  );
  expect(
    (await originalStoredResponse.arrayBuffer()).byteLength
  ).toBeGreaterThan(0);
  expect(await hasStoredObject(originalPath)).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true })
  ).toHaveValue(editorTitle);
  await expect(
    page.getByRole("textbox", { name: "Texto alternativo da capa" })
  ).toHaveValue(originalAlt);
  await expectImageLoaded(page.locator(".community-editor-cover-preview"));

  expect(await appAssetStatus(page, originalPath)).toBe(200);
  const anonymousAppContext = await playwrightRequest.newContext({
    baseURL: baseUrl,
    storageState: emptyStorageState,
  });
  try {
    expect((await anonymousAppContext.storageState()).cookies).toHaveLength(0);
    const anonymousAppResponse = await anonymousAppContext.get(
      assetUrl(originalPath),
      { maxRedirects: 0 }
    );
    expect(anonymousAppResponse.status()).toBe(401);
  } finally {
    await anonymousAppContext.dispose();
  }

  const directAnonymousStorageResponse = await readStoredObject(
    originalPath,
    storageAnon
  );
  expect(directAnonymousStorageResponse.ok).toBe(false);

  const adminContext = await browser.newContext({
    baseURL: baseUrl,
    storageState: adminStatePath,
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/comunidade");
  expect(await clerkUserId(adminPage)).toBe(process.env.COMMUNITY_QA_ADMIN_ID);
  const outsiderContext = await browser.newContext({
    baseURL: baseUrl,
    storageState: emptyStorageState,
  });
  const outsiderPage = await outsiderContext.newPage();
  try {
    expect(await appAssetStatus(adminPage, originalPath)).toBe(200);

    await setupClerkTestingToken({ page: outsiderPage });
    await outsiderPage.goto("/sign-in");
    await clerk.loaded({ page: outsiderPage });
    await clerk.signIn({ emailAddress: otherMember.email, page: outsiderPage });
    expect(await clerkUserId(outsiderPage)).toBe(otherMember.clerkUserId);
    expect(await clerkUserId(outsiderPage)).not.toBe(
      process.env.COMMUNITY_QA_MEMBER_ID
    );
    await outsiderPage.goto("/comunidade/minhas-publicacoes");
    await expect(
      outsiderPage.getByRole("heading", { name: "Minhas publicações" })
    ).toBeVisible();
    expect(await appAssetStatus(outsiderPage, originalPath)).toBe(404);

    // Leaving with pending changes shows the board's confirmation and saves the draft.
    await page
      .getByRole("textbox", { name: "Título", exact: true })
      .fill(`${editorTitle} ajustada`);
    await page
      .getByRole("link", { name: "Voltar" })
      .click({ force: true, timeout: 5000 });
    const exitDialog = page.getByRole("alertdialog");
    await expect(
      exitDialog.getByRole("heading", { name: "Sair do editor?" })
    ).toBeVisible();
    await page.screenshot({
      path: resolve(outputDirectory, "community-exit-with-changes-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await expect(
      exitDialog.getByRole("button", { name: "Sair e manter rascunho" })
    ).toBeVisible();
    await exitDialog
      .getByRole("button", { name: "Sair e manter rascunho" })
      .dispatchEvent("click");
    await expect(page).toHaveURL(communityHomeUrlPattern);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(editorUrl);
    await expect(
      page.getByRole("textbox", { name: "Título", exact: true })
    ).toHaveValue(`${editorTitle} ajustada`);
    await page
      .getByRole("textbox", { name: "Título", exact: true })
      .fill(`${editorTitle} ajustada mobile`);
    await page
      .getByRole("link", { name: "Voltar" })
      .click({ force: true, timeout: 5000 });
    const mobileExitDialog = page.getByRole("alertdialog");
    await expect(
      mobileExitDialog.getByRole("heading", { name: "Sair do editor?" })
    ).toBeVisible();
    await expect(
      mobileExitDialog.getByRole("button", { name: "Sair e manter rascunho" })
    ).toBeVisible();
    await page.screenshot({
      path: resolve(outputDirectory, "community-exit-with-changes-mobile.png"),
      animations: "disabled",
    });
    if (await mobileExitDialog.isVisible().catch(() => false)) {
      await mobileExitDialog
        .getByRole("button", { name: "Continuar editando" })
        .dispatchEvent("click");
    }
    await expect(
      mobileExitDialog.getByRole("heading", { name: "Sair do editor?" })
    ).toBeHidden();
  } finally {
    await adminContext.close();
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(editorUrl);
  const titleInput = page.getByRole("textbox", { name: "Título", exact: true });
  await titleInput.fill(`${editorTitle} ajustada mobile`);
  await expect(
    page.getByText("Rascunho salvo · visível só para você")
  ).toBeVisible({ timeout: 20_000 });
  await expectImageLoaded(page.locator(".community-editor-cover-preview"));
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(publishedPostUrlPattern, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: `${editorTitle} ajustada mobile` })
  ).toBeVisible();
  const publishedPostUrl = page.url();
  await page.reload();
  await expectImageLoaded(page.getByRole("img", { name: originalAlt }));
  expect(await appAssetStatus(outsiderPage, originalPath)).toBe(200);

  await page.goto(editorUrl);
  const replacementUploadPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/member-assets") &&
      response.request().method() === "POST"
  );
  await coverInput.setInputFiles(replacementImage);
  const replacementResponse = await replacementUploadPromise;
  expect(replacementResponse.ok()).toBe(true);
  const replacementUpload = (await replacementResponse.json()) as {
    readonly path: string;
  };
  const replacementPath = replacementUpload.path;
  expect(replacementPath).not.toBe(originalPath);
  expect(await hasStoredObject(replacementPath)).toBe(true);
  await page
    .getByRole("textbox", { name: "Texto alternativo da capa" })
    .fill(replacementAlt);
  await expect(
    page.getByText("Alterações não salvas", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Edição publicada", { exact: true })).toBeVisible(
    {
      timeout: 30_000,
    }
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Texto alternativo da capa" })
  ).toHaveValue(replacementAlt);
  await expectImageLoaded(page.locator(".community-editor-cover-preview"));
  expect(await hasStoredObject(originalPath)).toBe(false);
  expect((await readStoredObject(originalPath)).ok).toBe(false);
  await page.goto(publishedPostUrl);
  await page.reload();
  await expectImageLoaded(page.getByRole("img", { name: replacementAlt }));
  expect((await readStoredObject(replacementPath)).ok).toBe(true);

  await page.goto(editorUrl);
  await page.getByRole("button", { name: "Remover capa" }).click();
  await expect(page.locator(".community-editor-cover-preview")).toHaveCount(0);
  await expect(
    page.getByText("Alterações não salvas", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Edição publicada", { exact: true })).toBeVisible(
    {
      timeout: 30_000,
    }
  );
  await page.reload();
  await expect(page.locator(".community-editor-cover-preview")).toHaveCount(0);
  await page.goto(publishedPostUrl);
  await page.reload();
  await expect(page.getByRole("img", { name: replacementAlt })).toHaveCount(0);
  expect((await readStoredObject(replacementPath)).ok).toBe(false);

  const publishedQuery = new URLSearchParams({
    q: `${editorTitle} ajustada mobile`,
    status: "published",
  });
  await page.goto(
    `/comunidade/minhas-publicacoes?${publishedQuery.toString()}`
  );
  const card = page
    .locator("article")
    .filter({ hasText: `${editorTitle} ajustada mobile` })
    .first();
  await card.getByRole("button", { name: "Ações da publicação" }).click();
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
  await outsiderContext.close();
});

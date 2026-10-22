import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { clerkUserId } from "./auth-state";
import {
  adminStatePath,
  authDirectory,
  memberStatePath,
  teacherStatePath,
} from "./auth-state-paths";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", runId);
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";
const genericTitle = "Publicação da Comunidade | Interprete";
const genericDescription = "Acesse o Interprete para continuar a conversa.";
const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const noIndexPattern = /noindex/;

type DatabaseOperation =
  | "create-fixtures"
  | "set-membership"
  | "share-link-evidence"
  | "private-access-audit-count"
  | "member-details"
  | "cleanup";

const queryDatabase = <T>(
  operation: DatabaseOperation,
  input: Record<string, unknown>
) =>
  new Promise<T>((resolveQuery, rejectQuery) => {
    const queryProcess = spawn(
      "bun",
      ["--conditions=react-server", "e2e/community-v2/community-shares-db.ts"],
      { cwd: process.cwd(), env: process.env, windowsHide: true }
    );
    let output = "";
    let errorOutput = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      queryProcess.kill();
      rejectQuery(new Error(`Local share QA query timed out (${operation}).`));
    }, 30_000);
    queryProcess.stdout.setEncoding("utf8");
    queryProcess.stderr.setEncoding("utf8");
    queryProcess.stdout.on("data", (chunk: string) => (output += chunk));
    queryProcess.stderr.on("data", (chunk: string) => (errorOutput += chunk));
    queryProcess.on("error", (error) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }
      settled = true;
      rejectQuery(error);
    });
    queryProcess.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }
      settled = true;
      if (code !== 0) {
        rejectQuery(new Error(errorOutput || `Local QA query exited ${code}.`));
        return;
      }
      try {
        resolveQuery(JSON.parse(output) as T);
      } catch (error) {
        rejectQuery(error);
      }
    });
    queryProcess.stdin.end(JSON.stringify({ operation, input }));
  });

const assertIsolatedQa = () => {
  const databaseUrl = new URL(
    process.env.DATABASE_URL ?? "http://invalid.local"
  );
  const memberId = process.env.COMMUNITY_QA_MEMBER_ID;
  const secondaryMemberId = process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID;
  const teacherId = process.env.COMMUNITY_QA_TEACHER_ID;
  const adminId = process.env.COMMUNITY_QA_ADMIN_ID;
  const memberEmail = process.env.COMMUNITY_QA_MEMBER_EMAIL;
  if (
    runId === "missing-run-id" ||
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54325" ||
    databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
    !memberId ||
    !secondaryMemberId ||
    !teacherId ||
    !adminId ||
    !memberEmail
  ) {
    throw new Error(
      "Run scripts/community-v2/run-local-qa.ps1 -Suite shares with the existing Clerk Development accounts."
    );
  }
  return { memberId, secondaryMemberId, teacherId, adminId, memberEmail };
};

const captureScreenshot = async (page: Page, name: string) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(outputDirectory, name),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  });
};

const openShareDialog = async (page: Page) => {
  await page.getByRole("button", { name: "Compartilhar" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Compartilhar publicação",
  });
  await expect(dialog).toBeVisible();
  return dialog;
};

const createShareFromUi = async (page: Page) => {
  const dialog = await openShareDialog(page);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/community/post-shares"
  );
  await dialog.getByRole("button", { name: "Gerar link e copiar" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const created = (await response.json()) as {
    readonly id: string;
    readonly url: string;
  };
  const linkInput = dialog.getByRole("textbox", {
    name: "Link de compartilhamento",
  });
  await expect(linkInput).toHaveValue(created.url);
  await expect(dialog.getByRole("status")).toBeVisible();
  return { dialog, id: created.id, url: created.url };
};

const tokenFromUrl = (value: string) => {
  const token = new URL(value, appUrl).pathname.split("/").at(-1) ?? "";
  expect(token).toMatch(shareTokenPattern);
  return token;
};

const assertGenericPrivateShare = async (
  page: Page,
  hiddenValues: readonly string[]
) => {
  await expect(page).toHaveTitle(genericTitle);
  await expect(
    page.getByRole("heading", {
      name: "Acesse o Interprete para continuar a conversa.",
    })
  ).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    genericDescription
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    genericTitle
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    genericDescription
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    noIndexPattern
  );
  const html = await page.content();
  for (const value of hiddenValues.filter(Boolean)) {
    expect(html).not.toContain(value);
  }
};

test("compartilhamento V2 preserva permissões, prévia SSR, retorno Clerk e revogação", async ({
  browser,
  page,
}) => {
  test.setTimeout(600_000);
  const { memberId, secondaryMemberId, teacherId, adminId, memberEmail } =
    assertIsolatedQa();
  await mkdir(outputDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  const fixture = await queryDatabase<{
    privatePost: { id: string; title: string };
    publicPost: { id: string; title: string };
    privateExcerpt: string;
    privateCoverAlt: string;
    privateComment: string;
    publicComment: string;
    publicSubtitle: string;
    space: {
      id: string;
      slug: string;
      title: string;
      description: string;
      details: string;
    };
  }>("create-fixtures", { ownerId: secondaryMemberId, runId });
  const publicPostPath = `/comunidade/publicacoes/${fixture.publicPost.id}`;
  const privatePostPath = `/comunidade/${fixture.space.slug}/${fixture.privatePost.id}`;
  const hiddenPrivateValues = [
    fixture.privatePost.title,
    fixture.privateExcerpt,
    fixture.privateCoverAlt,
    `community-assets/covers/${secondaryMemberId}/share-qa-${runId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}.png`,
    `Corpo privado ${runId}`,
    fixture.privateComment,
    fixture.space.title,
    fixture.space.description,
    fixture.space.details,
  ];
  const postIds = [fixture.privatePost.id, fixture.publicPost.id];

  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  try {
    const authorDetails = await queryDatabase<
      Array<{
        id: string;
        profile: { displayName: string | null; username: string | null } | null;
      }>
    >("member-details", { memberIds: [secondaryMemberId] });
    const privateAuthor = authorDetails[0];
    if (privateAuthor?.profile?.displayName) {
      hiddenPrivateValues.push(privateAuthor.profile.displayName);
    }
    if (privateAuthor?.profile?.username) {
      hiddenPrivateValues.push(privateAuthor.profile.username);
    }

    await page.goto(publicPostPath);
    await expect(
      page.getByRole("heading", { name: fixture.publicPost.title })
    ).toBeVisible();
    const publicShare = await createShareFromUi(page);
    const publicToken = tokenFromUrl(publicShare.url);
    await captureScreenshot(page, "community-shares-dialog-1440.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await captureScreenshot(page, "community-shares-dialog-390.png");
    await publicShare.dialog
      .getByRole("button", {
        name: "Fechar compartilhamento",
      })
      .click();
    await captureScreenshot(page, "community-shares-public-post-1280.png");
    await page.setViewportSize({ width: 1440, height: 1000 });

    const publicLinkRows = await queryDatabase<
      Array<{
        id: string;
        tokenHash: string;
        createdById: string | null;
        revokedAt: string | null;
      }>
    >("share-link-evidence", { postId: fixture.publicPost.id });
    const publicStoredLink = publicLinkRows.find(
      ({ tokenHash }) =>
        tokenHash === createHash("sha256").update(publicToken).digest("hex")
    );
    expect(publicStoredLink).toMatchObject({
      id: publicShare.id,
      createdById: secondaryMemberId,
      revokedAt: null,
    });
    expect(JSON.stringify(publicLinkRows)).not.toContain(publicToken);

    const noJsContext = await browser.newContext({
      javaScriptEnabled: false,
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    contexts.push(noJsContext);
    const noJsPage = await noJsContext.newPage();
    const publicHtmlResponse = await noJsPage.goto(publicShare.url);
    expect(publicHtmlResponse?.status()).toBe(200);
    expect(await clerkUserId(noJsPage)).toBeNull();
    await expect(
      noJsPage.getByRole("heading", { name: fixture.publicPost.title })
    ).toBeVisible();
    await expect(
      noJsPage.getByText(fixture.publicSubtitle, { exact: true })
    ).toBeVisible();
    await expect(
      noJsPage.getByText(fixture.publicComment, { exact: true })
    ).toHaveCount(0);
    await expect(
      noJsPage.getByText("1 resposta", { exact: true })
    ).toBeVisible();
    await expect(
      noJsPage.locator(".community-share-landing__body-excerpt")
    ).toContainText(`Corpo público ${runId}`);
    await expect(noJsPage.locator("time[datetime]")).toHaveCount(1);
    await expect(
      noJsPage.getByText(`Trecho público ${runId}`, { exact: true })
    ).toBeVisible();
    await expect(noJsPage.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      `${fixture.publicPost.title} | Comunidade do Interprete`
    );
    await expect(noJsPage.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );
    const publicOgImage = await noJsPage
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(publicOgImage).toContain(
      `/comunidade/compartilhar/${publicToken}/opengraph-image`
    );
    const publicOgResponse = await noJsPage.request.get(publicOgImage ?? "");
    expect(publicOgResponse.status()).toBe(200);
    expect(publicOgResponse.headers()["content-type"]).toContain("image/png");
    expect(publicOgResponse.headers()["cache-control"]).toContain("no-store");
    expect(publicOgResponse.headers()["referrer-policy"]).toBe("no-referrer");
    await writeFile(
      resolve(outputDirectory, "community-shares-public-og-1200x630.png"),
      await publicOgResponse.body()
    );
    for (const width of [320, 360, 390, 768, 820, 1024, 1280, 1440]) {
      await noJsPage.setViewportSize({
        width,
        height: width <= 767 ? 844 : 1000,
      });
      const fitsViewport = await noJsPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      );
      expect(fitsViewport, `public landing overflow at ${width}px`).toBe(true);
      if (width === 1280) {
        await captureScreenshot(
          noJsPage,
          "community-shares-public-landing-1280.png"
        );
      }
      if (width === 390) {
        await captureScreenshot(
          noJsPage,
          "community-shares-public-landing-390.png"
        );
      }
    }

    const privateShare = await createShareFromUiForPost(
      page,
      privatePostPath,
      fixture.privatePost.title
    );
    const privateToken = tokenFromUrl(privateShare.url);
    await privateShare.dialog
      .getByRole("button", {
        name: "Fechar compartilhamento",
      })
      .click();

    const privateLinkRows = await queryDatabase<
      Array<{
        id: string;
        tokenHash: string;
        createdById: string | null;
        revokedAt: string | null;
      }>
    >("share-link-evidence", { postId: fixture.privatePost.id });
    const privateStoredLink = privateLinkRows.find(
      ({ tokenHash }) =>
        tokenHash === createHash("sha256").update(privateToken).digest("hex")
    );
    expect(privateStoredLink).toMatchObject({
      id: privateShare.id,
      createdById: secondaryMemberId,
      revokedAt: null,
    });
    expect(JSON.stringify(privateLinkRows)).not.toContain(privateToken);

    const anonymousContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 390, height: 844 },
    });
    contexts.push(anonymousContext);
    const anonymousPage = await anonymousContext.newPage();
    const anonymousPrivateResponse = await anonymousPage.goto(privateShare.url);
    expect(anonymousPrivateResponse?.status()).toBe(200);
    await assertGenericPrivateShare(anonymousPage, hiddenPrivateValues);
    const privateCoverResponse = await anonymousPage.request.get(
      `${privateShare.url}/cover`
    );
    expect(privateCoverResponse.status()).toBe(404);
    expect(privateCoverResponse.headers()["cache-control"]).toContain(
      "no-store"
    );
    await captureScreenshot(
      anonymousPage,
      "community-shares-private-generic-390.png"
    );

    const invalidToken = randomBytes(32).toString("base64url");
    const invalidPage = await anonymousContext.newPage();
    await invalidPage.goto(`/comunidade/compartilhar/${invalidToken}`);
    await assertGenericPrivateShare(invalidPage, hiddenPrivateValues);
    await invalidPage.close();

    const memberContext = await browser.newContext({
      storageState: memberStatePath,
    });
    const teacherContext = await browser.newContext({
      storageState: teacherStatePath,
    });
    const adminContext = await browser.newContext({
      storageState: adminStatePath,
    });
    contexts.push(memberContext, teacherContext, adminContext);
    const memberPage = await memberContext.newPage();
    await memberPage.goto(privateShare.url);
    expect(await clerkUserId(memberPage)).toBe(memberId);
    await assertGenericPrivateShare(memberPage, hiddenPrivateValues);

    const unauthorizedDelete = await memberPage.evaluate(async (shareId) => {
      const response = await fetch(`/api/community/post-shares/${shareId}`, {
        method: "DELETE",
      });
      return response.status;
    }, privateShare.id);
    expect(unauthorizedDelete).toBe(404);

    await queryDatabase("set-membership", {
      spaceId: fixture.space.id,
      memberId,
      active: true,
    });
    await memberPage.reload();
    await expect(memberPage).toHaveURL(
      new URL(privatePostPath, appUrl).toString()
    );
    await expect(
      memberPage.getByRole("heading", { name: fixture.privatePost.title })
    ).toBeVisible();
    await expect(memberPage.getByText(fixture.privateComment)).toBeVisible();

    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto(privateShare.url);
    await expect(teacherPage).toHaveURL(
      new URL(privatePostPath, appUrl).toString()
    );
    await expect(
      teacherPage.getByRole("heading", { name: fixture.privatePost.title })
    ).toBeVisible();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(privateShare.url);
    await expect(adminPage).toHaveURL(
      new URL(privatePostPath, appUrl).toString()
    );
    await expect(
      adminPage.getByRole("heading", { name: fixture.privatePost.title })
    ).toBeVisible();

    const returningVisitor = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    contexts.push(returningVisitor);
    const returningPage = await returningVisitor.newPage();
    await returningPage.goto(privateShare.url);
    await assertGenericPrivateShare(returningPage, hiddenPrivateValues);
    const signInLink = returningPage.getByRole("link", {
      name: "Entrar para continuar",
    });
    const signInHref = await signInLink.getAttribute("href");
    expect(signInHref).toBeTruthy();
    expect(
      new URL(signInHref ?? "", appUrl).searchParams.get("redirect_url")
    ).toBe(`/comunidade/compartilhar/${privateToken}`);
    await signInLink.click();
    await clerk.loaded({ page: returningPage });
    await clerk.signIn({ emailAddress: memberEmail, page: returningPage });
    await expect(returningPage).toHaveURL(
      new URL(privatePostPath, appUrl).toString(),
      {
        timeout: 60_000,
      }
    );
    await expect(
      returningPage.getByRole("heading", { name: fixture.privatePost.title })
    ).toBeVisible();

    const ownerGroupPage = await page.context().newPage();
    await ownerGroupPage.goto(`/comunidade/grupos/${fixture.space.slug}`);
    await expect(
      ownerGroupPage.getByRole("button", { name: "Compartilhar grupo" })
    ).toHaveCount(0);
    await ownerGroupPage.close();

    const concurrentLinks = (await page.evaluate((postId) => {
      const requests = [0, 1].map(() =>
        fetch("/api/community/post-shares", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ postId }),
        }).then(async (response) => ({
          status: response.status,
          body: await response.json(),
        }))
      );
      return Promise.all(requests);
    }, fixture.publicPost.id)) as Array<{
      status: number;
      body: { id?: string; url?: string };
    }>;
    expect(concurrentLinks.map(({ status }) => status)).toEqual([201, 201]);
    const concurrentUrls = concurrentLinks.map(({ body }) => body.url ?? "");
    expect(new Set(concurrentUrls).size).toBe(2);
    const latestPublicRows = await queryDatabase<
      Array<{ id: string; tokenHash: string; revokedAt: string | null }>
    >("share-link-evidence", { postId: fixture.publicPost.id });
    for (const value of concurrentUrls) {
      const token = tokenFromUrl(value);
      expect(latestPublicRows).toContainEqual(
        expect.objectContaining({
          tokenHash: createHash("sha256").update(token).digest("hex"),
          revokedAt: null,
        })
      );
      expect(JSON.stringify(latestPublicRows)).not.toContain(token);
    }

    await page.goto(publicPostPath);
    await expect(
      page.getByRole("heading", { name: fixture.publicPost.title })
    ).toBeVisible();
    const reopenDialog = await openShareDialog(page);
    const originalLinkRow = reopenDialog.locator(
      `[data-share-link-id="${publicShare.id}"]`
    );
    await expect(originalLinkRow).toBeVisible();
    await originalLinkRow.getByRole("button", { name: "Revogar link" }).click();
    await expect(reopenDialog.getByRole("status")).toContainText(
      "Link revogado."
    );
    await expect(originalLinkRow).toContainText("Revogado");

    const revokedPage = await anonymousContext.newPage();
    await revokedPage.goto(publicShare.url);
    await assertGenericPrivateShare(revokedPage, []);
    const stillActivePage = await anonymousContext.newPage();
    await stillActivePage.goto(concurrentUrls[0] ?? "");
    await expect(
      stillActivePage.getByRole("heading", { name: fixture.publicPost.title })
    ).toBeVisible();
    await stillActivePage.close();
    await revokedPage.close();

    const staffAuditCount = await queryDatabase<number>(
      "private-access-audit-count",
      { actorId: teacherId, spaceId: fixture.space.id }
    );
    const adminAuditCount = await queryDatabase<number>(
      "private-access-audit-count",
      { actorId: adminId, spaceId: fixture.space.id }
    );
    expect(staffAuditCount).toBeGreaterThan(0);
    expect(adminAuditCount).toBeGreaterThan(0);

    await writeFile(
      resolve(outputDirectory, "community-shares-ssr-evidence.json"),
      `${JSON.stringify(
        {
          runId,
          localOnly: true,
          javascriptDisabled: true,
          publicHtmlStatus: publicHtmlResponse?.status(),
          publicOgTitle: `${fixture.publicPost.title} | Comunidade do Interprete`,
          publicOgImageContentType: publicOgResponse.headers()["content-type"],
          publicOgImageCacheControl:
            publicOgResponse.headers()["cache-control"],
          publicOgImageReferrerPolicy:
            publicOgResponse.headers()["referrer-policy"],
          anonymousPrivateMetadata: genericTitle,
          invalidMetadata: genericTitle,
          rawTokensPersisted: false,
          concurrentCreates: concurrentUrls.length,
          revokedLinkShowsGenericLanding: true,
          privatePageAfterClerkReturn: privatePostPath,
          externalPreviewCrawler:
            "not exercised; Vercel Preview remains protected",
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } finally {
    await queryDatabase("cleanup", {
      spaceId: fixture.space.id,
      postIds,
    }).catch(() => undefined);
    await Promise.all(contexts.map((context) => context.close()));
  }
});

const createShareFromUiForPost = async (
  page: Page,
  postPath: string,
  title: string
) => {
  await page.goto(postPath);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return createShareFromUi(page);
};

test("landing pública mostra prévia SSR responsiva sem JavaScript", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const { secondaryMemberId } = assertIsolatedQa();
  const fixture = await queryDatabase<{
    privatePost: { id: string; title: string };
    publicPost: { id: string; title: string };
    space: { id: string; slug: string };
  }>("create-fixtures", { ownerId: secondaryMemberId, runId });
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    const createResponse = await page.request.post(
      `${appUrl}/api/community/post-shares`,
      {
        headers: { origin: appUrl },
        data: { postId: fixture.publicPost.id },
      }
    );
    expect(createResponse.status()).toBe(201);
    const share = (await createResponse.json()) as { url: string };
    const token = tokenFromUrl(share.url);
    const context = await browser.newContext({
      javaScriptEnabled: false,
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    contexts.push(context);
    const anonymousPage = await context.newPage();
    const response = await anonymousPage.goto(share.url);
    expect(response?.status()).toBe(200);
    await expect(
      anonymousPage.getByRole("heading", { name: fixture.publicPost.title })
    ).toBeVisible();
    await expect(
      anonymousPage.getByText(`Uma pergunta para a comunidade ${runId}`, {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      anonymousPage.getByText("1 resposta", { exact: true })
    ).toBeVisible();
    await expect(
      anonymousPage.locator(".community-share-landing__body-excerpt")
    ).toContainText(`Corpo público ${runId}`);

    const publicOgImage = await anonymousPage
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    const ogResponse = await anonymousPage.request.get(publicOgImage ?? "");
    expect(ogResponse.status()).toBe(200);
    expect(ogResponse.headers()["content-type"]).toContain("image/png");
    expect(ogResponse.headers()["cache-control"]).toContain("no-store");
    await writeFile(
      resolve(outputDirectory, "community-shares-public-og-1200x630.png"),
      await ogResponse.body()
    );

    for (const width of [320, 360, 390, 768, 820, 1024, 1280, 1440]) {
      await anonymousPage.setViewportSize({
        width,
        height: width <= 767 ? 844 : 1000,
      });
      const fitsViewport = await anonymousPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      );
      expect(fitsViewport, `public landing overflow at ${width}px`).toBe(true);
      if (width === 1280 || width === 390) {
        await captureScreenshot(
          anonymousPage,
          `community-shares-public-landing-${width}.png`
        );
      }
    }

    expect(token).toMatch(shareTokenPattern);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await queryDatabase("cleanup", {
      spaceId: fixture.space.id,
      postIds: [fixture.privatePost.id, fixture.publicPost.id],
    }).catch(() => undefined);
  }
});

test("link privado mantém capa e OG genéricos para visitante anônimo", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const { memberId, secondaryMemberId } = assertIsolatedQa();
  const fixture = await queryDatabase<{
    privatePost: { id: string; title: string };
    publicPost: { id: string; title: string };
    privateExcerpt: string;
    privateCoverAlt: string;
    privateComment: string;
    space: {
      id: string;
      slug: string;
      title: string;
      description: string;
      details: string;
    };
  }>("create-fixtures", { ownerId: secondaryMemberId, runId });
  let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | null =
    null;

  try {
    await queryDatabase("set-membership", {
      spaceId: fixture.space.id,
      memberId,
      active: true,
    });
    const createResponse = await page.request.post(
      `${appUrl}/api/community/post-shares`,
      {
        headers: { origin: appUrl },
        data: { postId: fixture.privatePost.id },
      }
    );
    expect(createResponse.status()).toBe(201);
    const share = (await createResponse.json()) as { url: string };
    tokenFromUrl(share.url);

    anonymousContext = await browser.newContext({
      javaScriptEnabled: false,
      storageState: { cookies: [], origins: [] },
    });
    const anonymousPage = await anonymousContext.newPage();
    const shareResponse = await anonymousPage.goto(share.url);
    expect(shareResponse?.status()).toBe(200);
    await assertGenericPrivateShare(anonymousPage, [
      fixture.privatePost.title,
      fixture.privateExcerpt,
      fixture.privateCoverAlt,
      `Corpo privado ${runId}`,
      fixture.privateComment,
      fixture.space.title,
      fixture.space.description,
      fixture.space.details,
    ]);

    const coverResponse = await anonymousPage.request.get(`${share.url}/cover`);
    expect(coverResponse.status()).toBe(404);
    expect(coverResponse.headers()["cache-control"]).toContain("no-store");

    const privateOgResponse = await anonymousPage.request.get(
      `${share.url}/opengraph-image`
    );
    const invalidToken = randomBytes(32).toString("base64url");
    const invalidOgResponse = await anonymousPage.request.get(
      `${appUrl}/comunidade/compartilhar/${invalidToken}/opengraph-image`
    );
    expect(privateOgResponse.status()).toBe(200);
    expect(invalidOgResponse.status()).toBe(200);
    expect(privateOgResponse.headers()["content-type"]).toContain("image/png");
    expect(await privateOgResponse.body()).toEqual(
      await invalidOgResponse.body()
    );
  } finally {
    await anonymousContext?.close();
    await queryDatabase("cleanup", {
      spaceId: fixture.space.id,
      postIds: [fixture.privatePost.id, fixture.publicPost.id],
    }).catch(() => undefined);
  }
});

test("link público segue listado e revogável ao reabrir o diálogo", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const { secondaryMemberId } = assertIsolatedQa();
  const fixture = await queryDatabase<{
    privatePost: { id: string; title: string };
    publicPost: { id: string; title: string };
    privateExcerpt: string;
    privateCoverAlt: string;
    privateComment: string;
    space: { id: string; slug: string };
  }>("create-fixtures", { ownerId: secondaryMemberId, runId });
  const publicPostPath = `/comunidade/publicacoes/${fixture.publicPost.id}`;
  let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | null =
    null;

  try {
    const createResponse = await page.request.post(
      `${appUrl}/api/community/post-shares`,
      {
        headers: { origin: appUrl },
        data: { postId: fixture.publicPost.id },
      }
    );
    expect(createResponse.status()).toBe(201);
    const share = (await createResponse.json()) as { id: string; url: string };
    const token = tokenFromUrl(share.url);
    await page.goto(publicPostPath);
    const createdLinksDialog = await openShareDialog(page);
    await expect(
      createdLinksDialog.locator(`[data-share-link-id="${share.id}"]`)
    ).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await captureScreenshot(page, "community-shares-dialog-1280.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await captureScreenshot(page, "community-shares-dialog-mobile-390.png");
    await createdLinksDialog
      .getByRole("button", { name: "Fechar compartilhamento" })
      .click();

    anonymousContext = await browser.newContext({
      javaScriptEnabled: false,
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1280, height: 900 },
    });
    const anonymousPage = await anonymousContext.newPage();
    const publicResponse = await anonymousPage.goto(share.url);
    expect(publicResponse?.status()).toBe(200);
    await expect(
      anonymousPage.getByRole("heading", { name: fixture.publicPost.title })
    ).toBeVisible();
    await expect(
      anonymousPage.getByText(`Uma pergunta para a comunidade ${runId}`, {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      anonymousPage.getByText("1 resposta", { exact: true })
    ).toBeVisible();
    await expect(
      anonymousPage.locator(".community-share-landing__body-excerpt")
    ).toContainText(`Corpo público ${runId}`);
    await captureScreenshot(
      anonymousPage,
      "community-shares-public-landing-1280.png"
    );
    await anonymousPage.setViewportSize({ width: 390, height: 844 });
    await captureScreenshot(
      anonymousPage,
      "community-shares-public-landing-390.png"
    );

    await page.goto("/comunidade");
    await page.goto(publicPostPath);
    const dialog = await openShareDialog(page);
    const linkRow = dialog.locator(`[data-share-link-id="${share.id}"]`);
    await expect(linkRow).toBeVisible();
    await linkRow.getByRole("button", { name: "Revogar link" }).click();
    await expect(dialog.getByRole("status")).toContainText("Link revogado.");
    await expect(linkRow).toContainText("Revogado");

    const databaseLinks = await queryDatabase<
      Array<{ id: string; tokenHash: string; revokedAt: string | null }>
    >("share-link-evidence", { postId: fixture.publicPost.id });
    expect(databaseLinks.find((link) => link.id === share.id)).toMatchObject({
      tokenHash: createHash("sha256").update(token).digest("hex"),
      revokedAt: expect.any(String),
    });
    expect(JSON.stringify(databaseLinks)).not.toContain(token);

    await anonymousPage.goto(share.url);
    await assertGenericPrivateShare(anonymousPage, [fixture.publicPost.title]);
  } finally {
    if (anonymousContext) {
      await anonymousContext.close();
    }
    await queryDatabase("cleanup", {
      spaceId: fixture.space.id,
      postIds: [fixture.privatePost.id, fixture.publicPost.id],
    }).catch(() => undefined);
  }
});

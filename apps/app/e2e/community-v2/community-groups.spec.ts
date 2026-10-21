import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
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
const groupTitle = `Grupo QA ${runId}`;
const updatedGroupTitle = `Grupo QA revisado ${runId}`;
const postTitle = `Publicação de grupo ${runId}`;
const coverUrlPattern =
  /community-assets%2Fcovers%2F|community-assets\/covers\//;
const coverPathPattern = /^community-assets\/covers\//;
const groupUrlPattern = /\/comunidade\/grupos\/[^/?]+(?:\?.*)?$/;
const newGroupFormUrlPattern = /\/comunidade\/grupos\/novo(?:[?#]|$)/;
const postComposerUrlPattern = /\/comunidade\/(?:novo\?|editor\/)/;
const newPublicationButtonPattern = /Nova publicação/;

type GroupDatabaseOperation =
  | "active-members"
  | "initial-group"
  | "membership-role"
  | "updated-group"
  | "audit-count"
  | "published-post"
  | "archived-group"
  | "restored-group"
  | "membership-exists";

const queryGroupDatabase = <T>(
  operation: GroupDatabaseOperation,
  input: Record<string, string | string[]>
) =>
  new Promise<T>((resolveQuery, rejectQuery) => {
    const queryProcess = spawn(
      "bun",
      ["--conditions=react-server", "e2e/community-v2/community-groups-db.ts"],
      { cwd: process.cwd(), env: process.env, windowsHide: true }
    );
    let output = "";
    let errorOutput = "";
    queryProcess.stdout.setEncoding("utf8");
    queryProcess.stderr.setEncoding("utf8");
    queryProcess.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    queryProcess.stderr.on("data", (chunk: string) => {
      errorOutput += chunk;
    });
    queryProcess.on("error", rejectQuery);
    queryProcess.on("close", (code) => {
      if (code !== 0) {
        rejectQuery(
          new Error(errorOutput || `QA database query exited ${code}.`)
        );
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

const assertLocalQa = () => {
  const databaseUrl = new URL(
    process.env.DATABASE_URL ?? "http://invalid.local"
  );
  if (
    runId === "missing-run-id" ||
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54325" ||
    databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
    !process.env.COMMUNITY_QA_MEMBER_ID ||
    !process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID ||
    !process.env.COMMUNITY_QA_TEACHER_ID ||
    !process.env.COMMUNITY_QA_ADMIN_ID
  ) {
    throw new Error(
      "Run the guarded local Community V2 groups QA with the existing Clerk Development accounts first."
    );
  }
  return {
    ownerId: process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID,
    memberId: process.env.COMMUNITY_QA_MEMBER_ID,
    teacherId: process.env.COMMUNITY_QA_TEACHER_ID,
    adminId: process.env.COMMUNITY_QA_ADMIN_ID,
  };
};

const screenshot = async (
  page: import("@playwright/test").Page,
  name: string,
  fullPage = true
) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(outputDirectory, name),
    fullPage,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  });
};

test("cria, modera, restringe, audita, remove e restaura um grupo real", async ({
  browser,
  page,
}) => {
  test.setTimeout(360_000);
  const { ownerId, memberId, teacherId, adminId } = assertLocalQa();
  const accountIds = new Set([ownerId, memberId, teacherId, adminId]);
  const databaseMembers = await queryGroupDatabase<Array<{ id: string }>>(
    "active-members",
    { ids: [...accountIds] }
  );
  expect(new Set(databaseMembers.map(({ id }) => id))).toEqual(accountIds);
  await mkdir(outputDirectory, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/comunidade/grupos/novo");
  await clerk.loaded({ page });
  expect(await clerkUserId(page)).toBe(ownerId);
  await screenshot(page, "community-group-create-desktop.png");
  for (const width of [320, 360, 390, 768, 820, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await expect(
      page.getByRole("heading", { name: "Um lugar para aprender em conjunto." })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      `group creation overflows at ${width}px`
    ).toBe(true);
    if ([390, 820].includes(width)) {
      await screenshot(page, `community-group-create-${width}.png`, true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  const coverUpload = page.getByTestId("group-cover-upload");
  const coverResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/member-assets") &&
      response.request().method() === "POST"
  );
  await coverUpload
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "public/brand/community/study-group.png")
    );
  const coverResponse = await coverResponsePromise;
  const coverResponseBody = await coverResponse.json();
  expect(
    coverResponse.ok(),
    `Group cover upload failed: ${JSON.stringify(coverResponseBody)}`
  ).toBe(true);
  await expect(coverUpload.locator('input[name="coverUrl"]')).toHaveValue(
    coverUrlPattern,
    { timeout: 30_000 }
  );
  await expect(
    coverUpload.locator('input[name="coverUploadPending"]')
  ).toHaveValue("false");
  await page.locator('input[name="title"]').fill(groupTitle);
  await page
    .locator('textarea[name="description"]')
    .fill(`Descrição criada na jornada real ${runId}.`);
  await page
    .locator('textarea[name="details"]')
    .fill(`Sobre preservado durante arquivamento ${runId}.`);
  await page
    .locator('input[type="radio"][name="visibility"][value="PRIVATE"]')
    .check();
  await page.getByRole("button", { name: "Criar grupo de estudo" }).click();
  await expect(page).not.toHaveURL(newGroupFormUrlPattern, {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(groupUrlPattern);
  const groupUrl = new URL(page.url());
  const groupSlug = groupUrl.pathname.split("/").at(-1) ?? "";
  expect(groupSlug).toBeTruthy();
  const group = await queryGroupDatabase<{
    id: string;
    ownerId: string | null;
    visibility: string;
    status: string;
    coverUrl: string | null;
    members: Array<{ memberId: string; role: string }>;
  } | null>("initial-group", { groupSlug });
  expect(group).toMatchObject({
    ownerId,
    visibility: "PRIVATE",
    status: "PUBLISHED",
    members: [{ memberId: ownerId, role: "OWNER" }],
  });
  const coverPath = new URL(group?.coverUrl ?? "", appUrl).searchParams.get(
    "path"
  );
  expect(coverPath).toMatch(coverPathPattern);
  if (!coverPath) {
    throw new Error("The persisted group cover path is missing.");
  }
  const secondaryContext = await browser.newContext({
    storageState: memberStatePath,
    viewport: { width: 1440, height: 1000 },
  });
  const teacherContext = await browser.newContext({
    storageState: teacherStatePath,
    viewport: { width: 1440, height: 1000 },
  });
  const adminContext = await browser.newContext({
    storageState: adminStatePath,
    viewport: { width: 1440, height: 1000 },
  });
  const staffPages: Array<{
    readonly id: string;
    readonly page: import("@playwright/test").Page;
    readonly role: "TEACHER" | "ADMIN";
  }> = [];

  try {
    const secondaryPage = await secondaryContext.newPage();
    await secondaryPage.goto(`/comunidade/grupos/${groupSlug}`);
    await clerk.loaded({ page: secondaryPage });
    expect(await clerkUserId(secondaryPage)).toBe(memberId);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto(`/comunidade/grupos/${groupSlug}`);
    await clerk.loaded({ page: teacherPage });
    expect(await clerkUserId(teacherPage)).toBe(teacherId);
    await expect(
      secondaryPage.getByRole("heading", { name: groupTitle })
    ).toHaveCount(0);
    const privateCoverBeforeJoin = await secondaryPage.evaluate(
      async (path) => {
        const response = await fetch(
          `/api/member-assets?path=${encodeURIComponent(path)}`
        );
        return response.status;
      },
      coverPath
    );
    expect(privateCoverBeforeJoin).toBe(404);

    await page.goto(`/comunidade/grupos/${groupSlug}?view=settings`);
    await page.locator('select[name="visibility"]').selectOption("PUBLIC");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByText("Público", { exact: true }).first()
    ).toBeVisible();

    for (const [context, id, staffRole] of [
      [teacherContext, teacherId, "TEACHER"],
      [adminContext, adminId, "ADMIN"],
    ] as const) {
      const staffPage =
        context === teacherContext ? teacherPage : await context.newPage();
      await staffPage.goto(`/comunidade/grupos/${groupSlug}`);
      await clerk.loaded({ page: staffPage });
      expect(await clerkUserId(staffPage)).toBe(id);
      await staffPage
        .getByRole("button", { name: "Participar do grupo" })
        .click();
      const membership = await queryGroupDatabase<{ role: string } | null>(
        "membership-role",
        { spaceId: group?.id ?? "", memberId: id }
      );
      expect(membership?.role).toBe("MEMBER");
      staffPages.push({ id, page: staffPage, role: staffRole });
    }

    await secondaryPage.goto(`/comunidade/grupos/${groupSlug}`);
    await expect(
      secondaryPage.getByRole("heading", { name: groupTitle })
    ).toBeVisible();
    await expect(
      secondaryPage.getByRole("button", { name: "Participar do grupo" })
    ).toBeVisible();
    await secondaryPage
      .getByRole("button", { name: "Participar do grupo" })
      .click();
    await expect(
      secondaryPage.getByRole("button", { name: "Participar do grupo" })
    ).toHaveCount(0);
    const joined = await queryGroupDatabase<{ role: string } | null>(
      "membership-role",
      { spaceId: group?.id ?? "", memberId }
    );
    expect(joined?.role).toBe("MEMBER");

    await page.goto(`/comunidade/grupos/${groupSlug}?view=members`);
    await screenshot(page, "community-group-members-desktop.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, "community-group-members-mobile.png");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      "group members overflows at 390px"
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const roleForm = page.locator("form").filter({
      has: page.locator(`input[name="memberId"][value="${memberId}"]`),
    });
    await roleForm.locator('select[name="role"]').selectOption("MODERATOR");
    await roleForm.getByRole("button", { name: "Salvar" }).click();
    const memberRow = page.getByRole("listitem").filter({
      has: page.getByText("QA Comunidade V2 MEMBER member-b", {
        exact: true,
      }),
    });
    await expect(
      memberRow.locator("p").getByText("Moderador", { exact: true })
    ).toBeVisible();
    const promoted = await queryGroupDatabase<{ role: string } | null>(
      "membership-role",
      { spaceId: group?.id ?? "", memberId }
    );
    expect(promoted?.role).toBe("MODERATOR");

    for (const staffMember of staffPages) {
      await page.goto(`/comunidade/grupos/${groupSlug}?view=members`);
      const staffRoleForm = page.locator("form").filter({
        has: page.locator(`input[name="memberId"][value="${staffMember.id}"]`),
      });
      await staffRoleForm
        .locator('select[name="role"]')
        .selectOption("MODERATOR");
      await staffRoleForm.getByRole("button", { name: "Salvar" }).click();
      const protectedStaffRole = await queryGroupDatabase<{
        role: string;
      } | null>("membership-role", {
        spaceId: group?.id ?? "",
        memberId: staffMember.id,
      });
      expect(protectedStaffRole?.role).toBe("MEMBER");
    }

    for (const staffMember of staffPages) {
      await page.goto(`/comunidade/grupos/${groupSlug}?view=members`);
      const staffRemoveForm = page.locator("form").filter({
        has: page.locator(`input[name="memberId"][value="${staffMember.id}"]`),
      });
      await staffRemoveForm.getByRole("button", { name: "Remover" }).click();
      expect(
        await queryGroupDatabase<{ id: string } | null>("membership-exists", {
          spaceId: group?.id ?? "",
          memberId: staffMember.id,
        })
      ).toBeNull();
    }

    await page.goto(`/comunidade/grupos/${groupSlug}?view=settings`);
    await page.locator('select[name="visibility"]').selectOption("PRIVATE");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByText("Privado", { exact: true }).first()
    ).toBeVisible();

    await secondaryPage.goto(`/comunidade/grupos/${groupSlug}?view=settings`);
    await expect(
      secondaryPage.locator('select[name="visibility"]')
    ).toHaveCount(0);
    await expect(secondaryPage.locator('select[name="role"]')).toHaveCount(0);
    await expect(
      secondaryPage.getByRole("button", { name: "Arquivar grupo" })
    ).toHaveCount(0);
    await secondaryPage.locator('input[name="title"]').fill(updatedGroupTitle);
    await secondaryPage
      .locator('textarea[name="description"]')
      .fill(`Descrição atualizada pela moderadora ${runId}.`);
    await secondaryPage
      .locator('textarea[name="details"]')
      .fill(`Sobre atualizado pela moderadora ${runId}.`);
    const moderatorCoverUpload =
      secondaryPage.getByTestId("group-cover-upload");
    await moderatorCoverUpload
      .locator('input[type="file"]')
      .setInputFiles(
        resolve(
          process.cwd(),
          "public/portal/mobile-comunidade-fc58e6afaa.webp"
        )
      );
    await expect(
      moderatorCoverUpload.locator('input[name="coverUrl"]')
    ).not.toHaveValue(group?.coverUrl ?? "", { timeout: 30_000 });
    await expect(
      moderatorCoverUpload.locator('input[name="coverUploadPending"]')
    ).toHaveValue("false");
    const moderatorEditForm = secondaryPage
      .locator("form")
      .filter({ has: secondaryPage.locator('input[name="coverUrl"]') });
    await moderatorEditForm.evaluate((form) => {
      for (const [name, value] of [
        ["visibility", "PUBLIC"],
        ["role", "OWNER"],
        ["ownerId", "forged-owner"],
        ["status", "ARCHIVED"],
      ]) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
      }
    });
    await secondaryPage.locator('input[name="commentsOpen"]').uncheck();
    await secondaryPage
      .getByRole("button", { name: "Salvar alterações" })
      .click();
    const afterModeratorEdit = await queryGroupDatabase<{
      title: string;
      description: string | null;
      details: string | null;
      coverUrl: string | null;
      visibility: string;
      ownerId: string | null;
      commentsClosed: boolean;
      status: string;
    } | null>("updated-group", { groupId: group?.id ?? "" });
    expect(afterModeratorEdit).toMatchObject({
      title: updatedGroupTitle,
      visibility: "PRIVATE",
      ownerId,
      commentsClosed: true,
      status: "PUBLISHED",
    });
    expect(afterModeratorEdit?.description).toContain("moderadora");
    expect(afterModeratorEdit?.details).toContain("moderadora");
    expect(afterModeratorEdit?.coverUrl).not.toBe(group?.coverUrl);
    const moderatorRoleAfterForgery = await queryGroupDatabase<{
      role: string;
    } | null>("membership-role", {
      spaceId: group?.id ?? "",
      memberId,
    });
    expect(moderatorRoleAfterForgery?.role).toBe("MODERATOR");

    await secondaryPage.goto(`/comunidade/grupos/${groupSlug}?view=about`);
    await expect(
      secondaryPage.getByRole("heading", { name: updatedGroupTitle })
    ).toBeVisible();
    const newCoverPath = new URL(
      afterModeratorEdit?.coverUrl ?? "",
      appUrl
    ).searchParams.get("path");
    if (!newCoverPath) {
      throw new Error("The moderator replacement cover path is missing.");
    }
    const currentMemberCover = await secondaryPage.evaluate(async (path) => {
      const response = await fetch(
        `/api/member-assets?path=${encodeURIComponent(path)}`
      );
      return response.status;
    }, newCoverPath);
    expect(currentMemberCover).toBe(200);

    for (const staffMember of staffPages) {
      const { id: expectedId, page: staffPage, role: roleName } = staffMember;
      await staffPage.goto(`/comunidade/grupos/${groupSlug}`);
      await clerk.loaded({ page: staffPage });
      expect(await clerkUserId(staffPage)).toBe(expectedId);
      await expect(
        staffPage.getByRole("heading", { name: updatedGroupTitle })
      ).toBeVisible();
      const audit = await queryGroupDatabase<number>("audit-count", {
        actorId: expectedId,
        groupId: group?.id ?? "",
        role: roleName,
      });
      expect(audit).toBeGreaterThan(0);
    }

    await page.goto(`/comunidade/grupos/${groupSlug}`);
    await page
      .getByRole("button", { name: newPublicationButtonPattern })
      .click();
    await expect(page).toHaveURL(postComposerUrlPattern);
    await page
      .getByRole("textbox", { name: "Título", exact: true })
      .fill(postTitle);
    await page
      .getByRole("textbox", { name: "Conteúdo da publicação" })
      .fill(`Publicação real do grupo mantida após o arquivo ${runId}.`);
    await expect(
      page.getByText("Rascunho salvo · visível só para você")
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    const publishedPost = await queryGroupDatabase<{ id: string } | null>(
      "published-post",
      { groupId: group?.id ?? "", postTitle }
    );
    expect(publishedPost).not.toBeNull();

    await page.goto(`/comunidade/grupos/${groupSlug}?view=members`);
    const moderatorMemberRoleForm = page.locator("form").filter({
      has: page.locator(`input[name="memberId"][value="${memberId}"]`),
    });
    await moderatorMemberRoleForm
      .locator('select[name="role"]')
      .selectOption("MEMBER");
    await moderatorMemberRoleForm
      .getByRole("button", { name: "Salvar" })
      .click();
    const demoted = await queryGroupDatabase<{ role: string } | null>(
      "membership-role",
      { spaceId: group?.id ?? "", memberId }
    );
    expect(demoted?.role).toBe("MEMBER");

    await page.goto(`/comunidade/grupos/${groupSlug}?view=settings`);
    await page.getByRole("button", { name: "Arquivar grupo" }).click();
    await expect(
      page.getByText("Arquivado", { exact: true }).first()
    ).toBeVisible();
    const archived = await queryGroupDatabase<{
      status: string;
      visibility: string;
      ownerId: string | null;
      coverUrl: string | null;
      members: Array<{ memberId: string; role: string }>;
      posts: Array<{ id: string }>;
    } | null>("archived-group", { groupId: group?.id ?? "" });
    expect(archived).toMatchObject({
      status: "ARCHIVED",
      visibility: "PRIVATE",
      ownerId,
    });
    expect(
      Object.fromEntries(
        (archived?.members ?? []).map(
          ({ memberId: archivedMemberId, role }) => [archivedMemberId, role]
        )
      )
    ).toEqual({ [ownerId]: "OWNER", [memberId]: "MEMBER" });
    expect(archived?.posts.map(({ id }) => id)).toContain(publishedPost?.id);
    await secondaryPage.goto(`/comunidade/grupos/${groupSlug}`);
    await expect(
      secondaryPage.getByRole("heading", { name: updatedGroupTitle })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Restaurar grupo" }).click();
    await expect(page.getByText("Público", { exact: true })).toHaveCount(0);
    const restored = await queryGroupDatabase<{
      status: string;
      visibility: string;
      members: Array<{ memberId: string }>;
      posts: Array<{ id: string }>;
    } | null>("restored-group", {
      groupId: group?.id ?? "",
      postId: publishedPost?.id ?? "",
    });
    expect(restored).toMatchObject({
      status: "PUBLISHED",
      visibility: "PRIVATE",
    });
    expect(restored?.members).toHaveLength(2);
    expect(restored?.posts).toHaveLength(1);

    await page.goto(`/comunidade/grupos/${groupSlug}?view=members`);
    const removeForm = page.locator("form").filter({
      has: page.locator(`input[name="memberId"][value="${memberId}"]`),
    });
    await removeForm.getByRole("button", { name: "Remover" }).click();
    expect(
      await queryGroupDatabase<{ id: string } | null>("membership-exists", {
        spaceId: group?.id ?? "",
        memberId,
      })
    ).toBeNull();
    await secondaryPage.goto(`/comunidade/grupos/${groupSlug}`);
    await expect(
      secondaryPage.getByRole("heading", { name: updatedGroupTitle })
    ).toHaveCount(0);
    const removedCover = await secondaryPage.evaluate(async (path) => {
      const response = await fetch(
        `/api/member-assets?path=${encodeURIComponent(path)}`
      );
      return response.status;
    }, newCoverPath);
    expect(removedCover).toBe(404);

    await page.goto("/comunidade/grupos");
    await screenshot(page, "community-groups-directory-desktop.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/comunidade/grupos");
    await screenshot(page, "community-groups-directory-mobile.png");

    await page.goto(`/comunidade/grupos/${groupSlug}`);
    for (const width of [320, 360, 390, 768, 820, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await expect(
        page.getByRole("heading", { name: updatedGroupTitle })
      ).toBeVisible();
      const fitsViewport = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      );
      expect(fitsViewport, `layout overflows at ${width}px`).toBe(true);
      if ([390, 820, 1440].includes(width)) {
        await screenshot(page, `community-group-detail-${width}.png`, true);
      }
    }

    await page.goto(`/comunidade/grupos/${groupSlug}?view=about`);
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, "community-group-about-mobile.png");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      "group about overflows at 390px"
    ).toBe(true);

    await page.goto(`/comunidade/grupos/${groupSlug}?view=settings`);
    await screenshot(page, "community-group-settings-mobile.png");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      "group settings overflows at 390px"
    ).toBe(true);
  } finally {
    await secondaryContext.close();
    await teacherContext.close();
    await adminContext.close();
    for (const staffMember of staffPages) {
      await staffMember.page.close();
    }
  }
});

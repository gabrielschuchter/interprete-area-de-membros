import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { clerkUserId } from "./auth-state";
import {
  adminStatePath,
  authDirectory,
  memberStatePath,
  secondaryMemberStatePath,
  teacherStatePath,
} from "./auth-state-paths";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", runId);
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";
const newGroupCreationPath = /\/comunidade\/grupos\/novo(?:[?#]|$)/;
const groupDetailPath = /\/comunidade\/grupos\/[^/?]+$/;
const noIndexPattern = /noindex/;
const inviteTokenPattern = /^[A-Za-z0-9_-]{40,50}$/;
const memberCountPattern = /\d+ membros?/;
const invitationAttributionPattern = /convidou você para um grupo/;
const declinedStatusPattern = /^Recusado\b/;
const revokedStatusPattern = /^Revogado\b/;
const linkRevokedMessagePattern = /^Link revogado\./;
let privateGroupTitle = `Convites privados ${runId}`;
let privateGroupDescription = `Descrição privada de QA ${runId}.`;
let privateGroupDetails = `Detalhes privados de QA ${runId}.`;

type DatabaseOperation =
  | "group-by-slug"
  | "prepare-invitation-fixture"
  | "set-memberships"
  | "membership"
  | "remove-membership"
  | "invitation-states"
  | "invitation-by-id"
  | "active-links"
  | "all-links"
  | "member-search-details"
  | "outbox-notification-evidence"
  | "private-access-audit-count";

const queryDatabase = <T>(
  operation: DatabaseOperation,
  input: Record<string, unknown>
) =>
  new Promise<T>((resolveQuery, rejectQuery) => {
    const queryProcess = spawn(
      "bun",
      [
        "--conditions=react-server",
        "e2e/community-v2/community-invitations-db.ts",
      ],
      { cwd: process.cwd(), env: process.env, windowsHide: true }
    );
    let output = "";
    let errorOutput = "";
    let settled = false;
    const queryTimeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      queryProcess.kill();
      rejectQuery(
        new Error(`QA database query timed out after 30s (${operation}).`)
      );
    }, 30_000);
    queryProcess.stdout.setEncoding("utf8");
    queryProcess.stderr.setEncoding("utf8");
    queryProcess.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    queryProcess.stderr.on("data", (chunk: string) => {
      errorOutput += chunk;
    });
    queryProcess.on("error", (error) => {
      clearTimeout(queryTimeout);
      if (settled) {
        return;
      }
      settled = true;
      rejectQuery(error);
    });
    queryProcess.on("close", (code) => {
      clearTimeout(queryTimeout);
      if (settled) {
        return;
      }
      settled = true;
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

const assertIsolatedQa = () => {
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
    !process.env.COMMUNITY_QA_ADMIN_ID ||
    !process.env.COMMUNITY_QA_ADMIN_EMAIL ||
    !process.env.COMMUNITY_QA_MEMBER_EMAIL
  ) {
    throw new Error(
      "Run scripts/community-v2/run-local-qa.ps1 -Suite invitations with the existing Clerk Development accounts."
    );
  }
  return {
    memberId: process.env.COMMUNITY_QA_MEMBER_ID,
    secondaryMemberId: process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID,
    teacherId: process.env.COMMUNITY_QA_TEACHER_ID,
    adminId: process.env.COMMUNITY_QA_ADMIN_ID,
    memberEmail: process.env.COMMUNITY_QA_MEMBER_EMAIL,
  };
};

const screenshot = async (page: Page, name: string, fullPage = true) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(outputDirectory, name),
    fullPage,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  });
};

const createStudyGroup = async (
  page: Page,
  title: string,
  visibility: "PRIVATE" | "PUBLIC"
) => {
  await page.goto("/comunidade/grupos/novo");
  await page.locator('input[name="title"]').fill(title);
  await page
    .locator('textarea[name="description"]')
    .fill(
      `Descrição ${visibility === "PRIVATE" ? "privada" : "pública"} de QA ${runId}.`
    );
  await page
    .locator('textarea[name="details"]')
    .fill(`Detalhes privados de QA ${runId}.`);
  const visibilityRadio = page.locator(
    `input[name="visibility"][value="${visibility}"]`
  );
  await page.locator("label").filter({ has: visibilityRadio }).click();
  await expect(visibilityRadio).toBeChecked();
  await page.getByRole("button", { name: "Criar grupo de estudo" }).click();
  await expect(page).not.toHaveURL(newGroupCreationPath, {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(groupDetailPath);
  const slug = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const group = await queryDatabase<{
    id: string;
    slug: string;
    title: string;
    description: string;
    details: string;
    ownerId: string | null;
    visibility: string;
    status: string;
    members: Array<{ memberId: string; role: string }>;
  } | null>("group-by-slug", { slug });
  expect(group).toMatchObject({
    slug,
    title,
    visibility,
    status: "PUBLISHED",
  });
  return group;
};

const memberDetails = async (memberIds: readonly string[]) =>
  queryDatabase<
    Array<{
      id: string;
      role: string;
      displayName: string | null;
      profile: { displayName: string | null; username: string | null } | null;
    }>
  >("member-search-details", { memberIds });

const searchValueFor = (member: {
  readonly displayName: string | null;
  readonly profile: {
    readonly displayName: string | null;
    readonly username: string | null;
  } | null;
}) =>
  member.profile?.username ||
  member.profile?.displayName ||
  member.displayName ||
  "QA";

const regexEscape = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const selectInvitee = async (page: Page, searchValue: string) => {
  await page
    .getByPlaceholder("Busque pelo nome ou @username")
    .fill(searchValue);
  const candidate = page.getByRole("button", {
    name: new RegExp(regexEscape(searchValue), "i"),
  });
  await expect(candidate.first()).toBeVisible({ timeout: 15_000 });
  await candidate.first().click();
};

const openInvitations = async (page: Page) => {
  await page.getByRole("button", { name: "Convidar pessoas" }).click();
};

const profileInvitationResponse = async (
  page: Page,
  groupTitle: string,
  response: "Aceitar" | "Recusar"
) => {
  await page.goto("/perfil");
  await page
    .locator("summary")
    .filter({ hasText: "Convites para grupos" })
    .click();
  const invitationRow = page
    .locator("details")
    .filter({ hasText: "Convites para grupos" })
    .locator("ul > li")
    .filter({ hasText: groupTitle })
    .filter({ has: page.getByRole("button", { name: response }) })
    .first();
  await expect(invitationRow).toBeVisible();
  await invitationRow.getByRole("button", { name: response }).first().click();
};

const assertNoGroupMetadata = async (
  page: Page,
  hiddenValues: readonly string[]
) => {
  const html = await page.content();
  for (const hiddenValue of hiddenValues) {
    expect(html).not.toContain(hiddenValue);
  }
  await expect(page).toHaveTitle("Convite para grupo de estudo | Interprete");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Acesse o Interprete para responder a um convite."
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Convite para grupo de estudo | Interprete"
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Acesse o Interprete para responder a um convite."
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    noIndexPattern
  );
};

test("convites V2 cobrem papéis, estados, links privados e outbox em QA isolado", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  const { memberId, secondaryMemberId, teacherId, adminId, memberEmail } =
    assertIsolatedQa();
  await mkdir(outputDirectory, { recursive: true });
  const accounts = await memberDetails([
    memberId,
    secondaryMemberId,
    teacherId,
    adminId,
  ]);
  expect(new Set(accounts.map(({ id }) => id))).toEqual(
    new Set([memberId, secondaryMemberId, teacherId, adminId])
  );
  const accountFor = (id: string) => {
    const account = accounts.find((candidate) => candidate.id === id);
    if (!account) {
      throw new Error(`Missing isolated QA account ${id}.`);
    }
    return account;
  };
  const memberSearch = searchValueFor(accountFor(memberId));
  const teacherSearch = searchValueFor(accountFor(teacherId));
  const adminSearch = searchValueFor(accountFor(adminId));

  const memberContext = await browser.newContext({
    storageState: memberStatePath,
    viewport: { width: 1440, height: 1000 },
  });
  const secondaryContext = await browser.newContext({
    storageState: secondaryMemberStatePath,
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
  const visitorContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
  });

  try {
    let privateGroup = await queryDatabase<{
      id: string;
      slug: string;
      title: string;
      description: string;
      details: string;
      ownerId: string | null;
      visibility: string;
      status: string;
    } | null>("prepare-invitation-fixture", {
      ownerId: secondaryMemberId,
      memberIds: [memberId, secondaryMemberId, teacherId, adminId],
    });
    if (!privateGroup) {
      const ownerPage = await secondaryContext.newPage();
      await ownerPage.setViewportSize({ width: 1440, height: 1000 });
      await ownerPage.goto("/comunidade/grupos/novo");
      await clerk.loaded({ page: ownerPage });
      expect(await clerkUserId(ownerPage)).toBe(secondaryMemberId);
      privateGroup = await createStudyGroup(
        ownerPage,
        privateGroupTitle,
        "PRIVATE"
      );
    }
    if (!privateGroup) {
      throw new Error("The owner-created private QA group was not persisted.");
    }
    expect(privateGroup.ownerId).toBe(secondaryMemberId);
    privateGroupTitle = privateGroup.title;
    privateGroupDescription = privateGroup.description;
    privateGroupDetails = privateGroup.details;

    const anonymousPrivateGroupPage = await visitorContext.newPage();
    await anonymousPrivateGroupPage.goto(
      `/comunidade/grupos/${privateGroup.slug}`
    );
    expect(await clerkUserId(anonymousPrivateGroupPage)).toBeNull();
    await expect(
      anonymousPrivateGroupPage.getByRole("heading", {
        name: privateGroupTitle,
      })
    ).toHaveCount(0);
    const anonymousPrivateGroupHtml = await anonymousPrivateGroupPage.content();
    expect(anonymousPrivateGroupHtml).not.toContain(privateGroupTitle);
    expect(anonymousPrivateGroupHtml).not.toContain(privateGroupDescription);
    expect(anonymousPrivateGroupHtml).not.toContain(privateGroupDetails);
    await anonymousPrivateGroupPage.close();

    await queryDatabase("set-memberships", {
      spaceId: privateGroup.id,
      members: [{ memberId, role: "MEMBER" }],
    });

    const plainMemberPage = await memberContext.newPage();
    await plainMemberPage.goto(`/comunidade/grupos/${privateGroup.slug}`);
    await clerk.loaded({ page: plainMemberPage });
    expect(await clerkUserId(plainMemberPage)).toBe(memberId);
    await expect(
      plainMemberPage.getByRole("heading", { name: privateGroupTitle })
    ).toBeVisible();
    await expect(
      plainMemberPage.getByRole("button", { name: "Convidar pessoas" })
    ).toHaveCount(0);
    await expect(
      plainMemberPage.getByRole("button", { name: "Remover" })
    ).toHaveCount(0);

    const ownerPage = await secondaryContext.newPage();
    await ownerPage.goto(`/comunidade/grupos/${privateGroup.slug}`);
    await clerk.loaded({ page: ownerPage });
    expect(await clerkUserId(ownerPage)).toBe(secondaryMemberId);
    await openInvitations(ownerPage);
    await ownerPage.getByRole("tab", { name: "Pessoas" }).click();
    await selectInvitee(ownerPage, teacherSearch);
    await ownerPage.getByRole("button", { name: "Enviar convites" }).click();
    await expect(
      ownerPage.getByTestId("community-invite-batch-result")
    ).toContainText("Convites enviados.");
    const ownerInvite = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: privateGroup.id,
      memberIds: [teacherId],
    });
    expect(ownerInvite[0]?.status).toBe("PENDING");

    await queryDatabase("set-memberships", {
      spaceId: privateGroup.id,
      members: [{ memberId, role: "MODERATOR" }],
    });

    const moderatorAContext = await browser.newContext({
      storageState: memberStatePath,
      viewport: { width: 1440, height: 1000 },
    });
    const moderatorBContext = await browser.newContext({
      storageState: memberStatePath,
      viewport: { width: 1440, height: 1000 },
    });
    const moderatorA = await moderatorAContext.newPage();
    const moderatorB = await moderatorBContext.newPage();
    await Promise.all([
      moderatorA.goto(`/comunidade/grupos/${privateGroup.slug}`),
      moderatorB.goto(`/comunidade/grupos/${privateGroup.slug}`),
    ]);
    await Promise.all([
      clerk.loaded({ page: moderatorA }),
      clerk.loaded({ page: moderatorB }),
    ]);
    expect(await clerkUserId(moderatorA)).toBe(memberId);
    await Promise.all([
      openInvitations(moderatorA),
      openInvitations(moderatorB),
    ]);
    await Promise.all([
      moderatorA.getByRole("tab", { name: "Pessoas" }).click(),
      moderatorB.getByRole("tab", { name: "Pessoas" }).click(),
    ]);
    await Promise.all([
      selectInvitee(moderatorA, adminSearch),
      selectInvitee(moderatorB, adminSearch),
    ]);
    await Promise.all([
      moderatorA.getByRole("button", { name: "Enviar convites" }).click(),
      moderatorB.getByRole("button", { name: "Enviar convites" }).click(),
    ]);
    const concurrentResultA = moderatorA.getByTestId(
      "community-invite-batch-result"
    );
    const concurrentResultB = moderatorB.getByTestId(
      "community-invite-batch-result"
    );
    await Promise.all([
      expect(concurrentResultA).toBeVisible(),
      expect(concurrentResultB).toBeVisible(),
    ]);
    const concurrentResults = await Promise.all([
      concurrentResultA.innerText(),
      concurrentResultB.innerText(),
    ]);
    expect(
      concurrentResults.some((result) => result.includes("Convite enviado"))
    ).toBe(true);
    expect(
      concurrentResults.some((result) =>
        result.includes("Já existe um convite pendente")
      )
    ).toBe(true);
    const moderatorMembership = await queryDatabase<{
      id: string;
      role: string;
    } | null>("membership", { spaceId: privateGroup.id, memberId });
    expect(moderatorMembership?.role).toBe("MODERATOR");
    const firstGroupInvitation = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: privateGroup.id,
      memberIds: [adminId],
    });
    expect(firstGroupInvitation.length).toBeGreaterThan(0);
    expect(
      firstGroupInvitation.filter(({ status }) => status === "PENDING")
    ).toHaveLength(1);
    expect(firstGroupInvitation[0]?.status).toBe("PENDING");

    const adminPageA = await adminContext.newPage();
    const adminContextB = await browser.newContext({
      storageState: adminStatePath,
      viewport: { width: 1440, height: 1000 },
    });
    const adminPageB = await adminContextB.newPage();
    await Promise.all([
      profileInvitationResponse(adminPageA, privateGroupTitle, "Aceitar"),
      profileInvitationResponse(adminPageB, privateGroupTitle, "Aceitar"),
    ]);
    const acceptedPersonalInvitation = await queryDatabase<{
      id: string;
      inviteeId: string;
      inviterId: string | null;
      status: string;
    } | null>("invitation-by-id", {
      invitationId: firstGroupInvitation[0]?.id,
    });
    expect(acceptedPersonalInvitation?.status).toBe("ACCEPTED");
    const acceptedModeratorInvitee = await queryDatabase<{
      id: string;
      role: string;
    } | null>("membership", { spaceId: privateGroup.id, memberId: adminId });
    expect(acceptedModeratorInvitee?.role).toBe("MEMBER");
    await adminPageA.reload();
    await adminPageA
      .locator("summary")
      .filter({ hasText: "Convites para grupos" })
      .click();
    const acceptedInvitationRow = adminPageA.locator("li").filter({
      hasText: privateGroupTitle,
    });
    await expect(acceptedInvitationRow.first()).toContainText("Aceito");

    const outboxEvidence = await queryDatabase<{
      invitationId: string;
      notificationCount: number;
      producerEvent: {
        id: string;
        jobs: Array<{
          consumerKey: string;
          status: string;
          attemptCount: number;
        }>;
      } | null;
    }>("outbox-notification-evidence", {
      invitationId: firstGroupInvitation[0]?.id,
    });
    expect(outboxEvidence?.producerEvent).not.toBeNull();
    expect(outboxEvidence?.producerEvent?.jobs.length).toBeGreaterThan(0);
    expect(
      outboxEvidence?.producerEvent?.jobs.some(
        ({ status, attemptCount }) => status === "SUCCEEDED" && attemptCount > 0
      )
    ).toBe(true);
    expect(outboxEvidence?.notificationCount).toBe(1);

    const teacherInvitePage = await teacherContext.newPage();
    await profileInvitationResponse(
      teacherInvitePage,
      privateGroupTitle,
      "Aceitar"
    );
    const acceptedOwnerInvite = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: privateGroup.id,
      memberIds: [teacherId],
    });
    expect(
      acceptedOwnerInvite.some(({ status }) => status === "ACCEPTED")
    ).toBe(true);

    await queryDatabase("remove-membership", {
      spaceId: privateGroup.id,
      memberId: adminId,
    });
    await moderatorA.goto(`/comunidade/grupos/${privateGroup.slug}`);
    await openInvitations(moderatorA);
    await moderatorA.getByRole("tab", { name: "Pessoas" }).click();
    await selectInvitee(moderatorA, adminSearch);
    await moderatorA.getByRole("button", { name: "Enviar convites" }).click();
    await expect(
      moderatorA.getByTestId("community-invite-batch-result")
    ).toContainText("Convites enviados.");
    const moderatorRevocableInvite = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: privateGroup.id,
      memberIds: [adminId],
    });
    const pendingModeratorInvite = moderatorRevocableInvite.find(
      ({ status }) => status === "PENDING"
    );
    expect(pendingModeratorInvite).toBeTruthy();
    const moderatorRevokeForm = moderatorA.locator("form").filter({
      has: moderatorA.locator(
        `input[name="invitationId"][value="${pendingModeratorInvite?.id}"]`
      ),
    });
    await moderatorRevokeForm.getByRole("button", { name: "Revogar" }).click();
    await expect(
      moderatorA.getByText("Convite revogado.", { exact: true })
    ).toBeVisible();
    const moderatorRevokedInvite = await queryDatabase<{
      id: string;
      inviteeId: string;
      inviterId: string | null;
      status: string;
    } | null>("invitation-by-id", {
      invitationId: pendingModeratorInvite?.id,
    });
    expect(moderatorRevokedInvite?.status).toBe("REVOKED");

    const membersPage = await memberContext.newPage();
    await membersPage.goto(
      `/comunidade/grupos/${privateGroup.slug}?view=members`
    );
    await expect(membersPage.locator('select[name="role"]')).toHaveCount(0);
    await expect(
      membersPage.getByRole("button", { name: "Remover" })
    ).toHaveCount(1);
    await membersPage.setViewportSize({ width: 1280, height: 960 });
    await screenshot(membersPage, "community-invitation-members-1280.png");
    await membersPage.setViewportSize({ width: 390, height: 844 });
    await screenshot(membersPage, "community-invitation-members-390.png");
    await membersPage.setViewportSize({ width: 1280, height: 960 });
    const commonMemberForm = membersPage.locator("form").filter({
      has: membersPage.locator(`input[name="memberId"][value="${teacherId}"]`),
    });
    await commonMemberForm.getByRole("button", { name: "Remover" }).click();
    await expect(membersPage).toHaveURL(
      new RegExp(`${privateGroup.slug}\\?view=members$`)
    );
    const removedCommonMember = await queryDatabase<{
      id: string;
      role: string;
    } | null>("membership", {
      spaceId: privateGroup.id,
      memberId: teacherId,
    });
    expect(removedCommonMember).toBeNull();
    await queryDatabase("remove-membership", {
      spaceId: privateGroup.id,
      memberId,
    });
    await moderatorAContext.close();
    await moderatorBContext.close();

    const staffPage = await teacherContext.newPage();
    const staffGroup = privateGroup;
    const staffGroupTitle = privateGroupTitle;

    const adminPage = await adminContext.newPage();
    await adminPage.goto(`/comunidade/grupos/${staffGroup.slug}`);
    await clerk.loaded({ page: adminPage });
    expect(await clerkUserId(adminPage)).toBe(adminId);
    await expect(
      adminPage.getByRole("heading", { name: staffGroupTitle })
    ).toBeVisible();
    const staffAuditCount = await queryDatabase<number>(
      "private-access-audit-count",
      { spaceId: staffGroup.id, actorId: adminId }
    );
    expect(staffAuditCount).toBeGreaterThan(0);

    await openInvitations(adminPage);
    await adminPage.getByRole("tab", { name: "Pessoas" }).click();
    await selectInvitee(adminPage, memberSearch);
    await adminPage.getByRole("button", { name: "Enviar convites" }).click();
    await expect(
      adminPage.getByTestId("community-invite-batch-result")
    ).toContainText("Convites enviados.");
    const staffCreatedInvites = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: staffGroup.id,
      memberIds: [memberId],
    });
    expect(staffCreatedInvites.some(({ status }) => status === "PENDING")).toBe(
      true
    );

    await staffPage.goto(`/comunidade/grupos/${staffGroup.slug}`);
    await openInvitations(staffPage);
    await staffPage.getByRole("tab", { name: "Pessoas" }).click();
    await selectInvitee(staffPage, memberSearch);
    await selectInvitee(staffPage, adminSearch);
    await staffPage.getByRole("button", { name: "Enviar convites" }).click();
    const partialBatch = staffPage.getByTestId("community-invite-batch-result");
    await expect(partialBatch).toContainText(
      "Envio concluído com resultados individuais."
    );
    await expect(partialBatch).toContainText("Já existe um convite pendente");
    await expect(partialBatch).toContainText("Convite enviado");
    await staffPage.setViewportSize({ width: 1280, height: 960 });
    await screenshot(staffPage, "community-invitation-partial-1280.png");
    const batchInvites = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: staffGroup.id,
      memberIds: [memberId, adminId],
    });
    expect(
      batchInvites.filter(({ status }) => status === "PENDING")
    ).toHaveLength(2);

    await staffPage.setViewportSize({ width: 1280, height: 960 });
    await staffPage.goto(`/comunidade/grupos/${staffGroup.slug}`);
    await openInvitations(staffPage);
    await screenshot(staffPage, "community-invitation-dialog-1280.png", false);
    for (const width of [320, 360, 390, 768, 820, 1024, 1280, 1440]) {
      await staffPage.setViewportSize({
        width,
        height: width < 600 ? 844 : 1000,
      });
      await expect(staffPage.getByRole("dialog")).toBeVisible();
      expect(
        await staffPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        ),
        `invitation dialog overflows at ${width}px`
      ).toBe(true);
      if (width === 390) {
        await staffPage.setViewportSize({ width: 390, height: 1200 });
        await expect(
          staffPage.getByRole("button", { name: "Compartilhar o link" })
        ).toBeVisible();
        await expect(
          staffPage.getByRole("button", { name: "Enviar por e-mail" })
        ).toBeVisible();
        await expect(
          staffPage.getByRole("button", { name: "Buscar pessoas" })
        ).toBeVisible();
        await screenshot(
          staffPage,
          "community-invitation-sheet-390.png",
          false
        );
      }
    }
    await staffPage.setViewportSize({ width: 390, height: 844 });
    await staffPage.getByRole("button", { name: "Enviar por e-mail" }).click();
    await expect(staffPage.getByText("E-mail indisponível")).toBeVisible();
    await expect(
      staffPage.getByText("Nenhuma mensagem será enviada")
    ).toBeVisible();
    await staffPage
      .getByRole("button", { name: "Compartilhar o link" })
      .click();
    await staffPage.setViewportSize({ width: 1280, height: 960 });
    await staffPage.getByRole("button", { name: "Criar link" }).click();
    const generatedLinkInput = staffPage.getByRole("textbox", {
      name: "Link de convite",
    });
    await expect(generatedLinkInput).toBeVisible();
    const firstLinkUrl = await generatedLinkInput.inputValue();
    const firstLinkToken =
      new URL(firstLinkUrl).pathname.split("/").at(-1) ?? "";
    expect(firstLinkToken).toMatch(inviteTokenPattern);
    const firstLinkHash = createHash("sha256")
      .update(firstLinkToken)
      .digest("hex");
    const activeLinksAfterCreate = await queryDatabase<
      Array<{
        id: string;
        tokenHash: string;
        createdAt: string;
        revokedAt: null;
      }>
    >("active-links", { spaceId: staffGroup.id });
    expect(activeLinksAfterCreate).toHaveLength(1);
    expect(activeLinksAfterCreate[0]?.tokenHash).toBe(firstLinkHash);
    expect(activeLinksAfterCreate[0]?.tokenHash).not.toBe(firstLinkToken);

    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(firstLinkUrl);
    await expect(
      visitorPage.getByRole("heading", {
        name: "Entre para conferir o convite.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(visitorPage, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    const signInHref = await visitorPage
      .getByRole("link", { name: "Entrar para aceitar" })
      .getAttribute("href");
    if (!signInHref) {
      throw new Error("The invite page did not provide a sign-in link.");
    }
    expect(new URL(signInHref, appUrl).searchParams.get("redirect_url")).toBe(
      `/comunidade/convite/${firstLinkToken}`
    );
    await visitorPage
      .getByRole("link", { name: "Entrar para aceitar" })
      .click();
    await clerk.loaded({ page: visitorPage });
    await clerk.signIn({ emailAddress: memberEmail, page: visitorPage });
    await expect(visitorPage).toHaveURL(
      new URL(`/comunidade/convite/${firstLinkToken}`, appUrl).toString()
    );
    await expect(
      visitorPage.getByRole("heading", { name: staffGroupTitle })
    ).toBeVisible();
    await expect(
      visitorPage.getByRole("article", {
        name: "Prévia do convite para grupo",
      })
    ).toBeVisible();
    await expect(
      visitorPage.getByText("Privado", { exact: true })
    ).toBeVisible();
    await expect(visitorPage.getByText(memberCountPattern)).toBeVisible();
    await expect(
      visitorPage.getByText(invitationAttributionPattern)
    ).toBeVisible();
    await expect(
      visitorPage.getByRole("button", { name: "Entrar no grupo" })
    ).toBeVisible();
    await assertNoGroupMetadata(visitorPage, []);
    await visitorPage.setViewportSize({ width: 1280, height: 960 });
    await screenshot(visitorPage, "community-invitation-link-1280.png");
    await visitorPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await visitorPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await screenshot(visitorPage, "community-invitation-link-390.png");
    await visitorPage.setViewportSize({ width: 1440, height: 1000 });

    const concurrentlyAuthenticatedMemberPage = await memberContext.newPage();
    await concurrentlyAuthenticatedMemberPage.goto(firstLinkUrl);
    await clerk.loaded({ page: concurrentlyAuthenticatedMemberPage });
    expect(await clerkUserId(concurrentlyAuthenticatedMemberPage)).toBe(
      memberId
    );
    await Promise.all([
      visitorPage.getByRole("button", { name: "Entrar no grupo" }).click(),
      concurrentlyAuthenticatedMemberPage
        .getByRole("button", { name: "Entrar no grupo" })
        .click(),
    ]);
    await expect(visitorPage).toHaveURL(
      new RegExp(`/comunidade/grupos/${staffGroup.slug}$`)
    );
    await expect(concurrentlyAuthenticatedMemberPage).toHaveURL(
      new RegExp(`/comunidade/grupos/${staffGroup.slug}$`)
    );
    const linkAcceptedMembership = await queryDatabase<{
      id: string;
      role: string;
    } | null>("membership", { spaceId: staffGroup.id, memberId });
    expect(linkAcceptedMembership?.role).toBe("MEMBER");
    const acceptedLinkInvitation = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: staffGroup.id,
      memberIds: [memberId],
    });
    expect(
      acceptedLinkInvitation.some(({ status }) => status === "ACCEPTED")
    ).toBe(true);

    await visitorPage.goto(firstLinkUrl);
    await expect(
      visitorPage.getByRole("heading", { name: "Você já está neste grupo" })
    ).toBeVisible();
    await expect(
      visitorPage.getByRole("link", { name: "Abrir grupo" })
    ).toBeVisible();
    await assertNoGroupMetadata(visitorPage, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    await visitorPage.setViewportSize({ width: 1280, height: 960 });
    await screenshot(
      visitorPage,
      "community-invitation-link-already-member-1280.png"
    );
    await visitorPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await visitorPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await screenshot(
      visitorPage,
      "community-invitation-link-already-member-390.png"
    );

    await profileInvitationResponse(adminPage, staffGroupTitle, "Recusar");
    const declinedInvitation = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: staffGroup.id,
      memberIds: [adminId],
    });
    expect(declinedInvitation.some(({ status }) => status === "DECLINED")).toBe(
      true
    );
    await adminPage.goto("/perfil");
    await adminPage
      .locator("summary")
      .filter({ hasText: "Convites para grupos" })
      .click();
    await expect(
      adminPage.getByText(declinedStatusPattern).first()
    ).toBeVisible();

    await queryDatabase("remove-membership", {
      spaceId: staffGroup.id,
      memberId: adminId,
    });
    await staffPage.goto(`/comunidade/grupos/${staffGroup.slug}`);
    await openInvitations(staffPage);
    await staffPage.getByRole("tab", { name: "Pessoas" }).click();
    await selectInvitee(staffPage, adminSearch);
    await staffPage.getByRole("button", { name: "Enviar convites" }).click();
    await expect(
      staffPage.getByTestId("community-invite-batch-result")
    ).toContainText("Convites enviados.");
    await staffPage.reload();
    await openInvitations(staffPage);
    const pendingMemberInvite = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: staffGroup.id,
      memberIds: [adminId],
    });
    const pendingMemberInvitation = pendingMemberInvite.find(
      ({ status }) => status === "PENDING"
    );
    expect(pendingMemberInvitation).toBeTruthy();
    const revokePersonalInviteForm = staffPage.locator("form").filter({
      has: staffPage.locator(
        `input[name="invitationId"][value="${pendingMemberInvitation?.id}"]`
      ),
    });
    await revokePersonalInviteForm
      .getByRole("button", { name: "Revogar" })
      .click();
    await staffPage.reload();
    const revokedInvitations = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: staffGroup.id,
      memberIds: [adminId],
    });
    expect(revokedInvitations.some(({ status }) => status === "REVOKED")).toBe(
      true
    );
    await adminPage.goto("/perfil");
    await adminPage
      .locator("summary")
      .filter({ hasText: "Convites para grupos" })
      .click();
    await expect(
      adminPage.getByText(revokedStatusPattern).first()
    ).toBeVisible();

    await staffPage.goto(`/comunidade/grupos/${staffGroup.slug}`);
    await openInvitations(staffPage);
    await staffPage.getByRole("tab", { name: "Link" }).click();
    await staffPage.getByRole("button", { name: "Regenerar link" }).click();
    const regeneratedLink = await staffPage
      .getByRole("textbox", { name: "Link de convite" })
      .inputValue();
    const regeneratedToken =
      new URL(regeneratedLink).pathname.split("/").at(-1) ?? "";
    expect(regeneratedToken).not.toBe(firstLinkToken);
    const regeneratedHash = createHash("sha256")
      .update(regeneratedToken)
      .digest("hex");
    const linksAfterRegeneration = await queryDatabase<
      Array<{
        id: string;
        tokenHash: string;
        createdAt: string;
        revokedAt: string | null;
      }>
    >("all-links", { spaceId: staffGroup.id });
    expect(
      linksAfterRegeneration.filter(({ revokedAt }) => revokedAt === null)
    ).toHaveLength(1);
    expect(
      linksAfterRegeneration.find(
        ({ tokenHash }) => tokenHash === firstLinkHash
      )?.revokedAt
    ).toBeTruthy();
    expect(
      linksAfterRegeneration.some(
        ({ tokenHash, revokedAt }) =>
          tokenHash === regeneratedHash && revokedAt === null
      )
    ).toBe(true);

    const invalidVisitorContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const invalidVisitor = await invalidVisitorContext.newPage();
    await invalidVisitor.goto(firstLinkUrl);
    await expect(
      invalidVisitor.getByRole("heading", {
        name: "Entre para conferir o convite.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(invalidVisitor, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    await invalidVisitorContext.close();

    const invalidAuthenticatedPage = await adminContext.newPage();
    await invalidAuthenticatedPage.goto("/comunidade/convite/token-invalido");
    await expect(
      invalidAuthenticatedPage.getByRole("heading", {
        name: "Este convite não vale mais.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(invalidAuthenticatedPage, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    await invalidAuthenticatedPage.close();

    const revokedAuthenticatedPage = await adminContext.newPage();
    await revokedAuthenticatedPage.goto(firstLinkUrl);
    await expect(
      revokedAuthenticatedPage.getByRole("heading", {
        name: "Este convite não vale mais.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(revokedAuthenticatedPage, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    await revokedAuthenticatedPage.close();

    await staffPage.getByRole("button", { name: "Revogar link" }).click();
    await expect(staffPage.getByText(linkRevokedMessagePattern)).toBeVisible();
    const activeLinksAfterRevocation = await queryDatabase<unknown[]>(
      "active-links",
      {
        spaceId: staffGroup.id,
      }
    );
    expect(activeLinksAfterRevocation).toHaveLength(0);
    const revokedAuthenticatedRegeneratedPage = await adminContext.newPage();
    await revokedAuthenticatedRegeneratedPage.goto(regeneratedLink);
    await expect(
      revokedAuthenticatedRegeneratedPage.getByRole("heading", {
        name: "Este convite não vale mais.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(revokedAuthenticatedRegeneratedPage, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    await revokedAuthenticatedRegeneratedPage.close();
    const revokedVisitorContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const revokedVisitor = await revokedVisitorContext.newPage();
    await revokedVisitor.goto(regeneratedLink);
    await expect(
      revokedVisitor.getByRole("heading", {
        name: "Entre para conferir o convite.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(revokedVisitor, [
      staffGroupTitle,
      privateGroupDescription,
      privateGroupDetails,
    ]);
    await revokedVisitorContext.close();

    await staffPage.goto(`/comunidade/grupos/${staffGroup.slug}?view=members`);
    await openInvitations(staffPage);
    await screenshot(staffPage, "community-invitation-management-1280.png");
    await staffPage.setViewportSize({ width: 390, height: 844 });
    await screenshot(staffPage, "community-invitation-management-390.png");
    expect(
      await staffPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  } finally {
    await Promise.all([
      memberContext.close(),
      secondaryContext.close(),
      teacherContext.close(),
      adminContext.close(),
      visitorContext.close(),
    ]);
  }
});

test("convites individuais e link funcionam em grupo público", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const { memberId, secondaryMemberId, adminId } = assertIsolatedQa();
  await mkdir(outputDirectory, { recursive: true });
  const accounts = await memberDetails([secondaryMemberId, adminId]);
  expect(new Set(accounts.map(({ id }) => id))).toEqual(
    new Set([secondaryMemberId, adminId])
  );
  const accountFor = (id: string) => {
    const account = accounts.find((candidate) => candidate.id === id);
    if (!account) {
      throw new Error(`Missing isolated QA account ${id}.`);
    }
    return account;
  };
  const adminSearch = searchValueFor(accountFor(adminId));
  const contexts = await Promise.all([
    browser.newContext({
      storageState: secondaryMemberStatePath,
      viewport: { width: 1440, height: 1000 },
    }),
    browser.newContext({
      storageState: adminStatePath,
      viewport: { width: 1440, height: 1000 },
    }),
    browser.newContext({
      storageState: memberStatePath,
      viewport: { width: 1440, height: 1000 },
    }),
    browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 390, height: 844 },
    }),
  ]);
  const [ownerContext, adminContext, memberContext, anonymousContext] =
    contexts;

  try {
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto("/comunidade/grupos/novo");
    await clerk.loaded({ page: ownerPage });
    expect(await clerkUserId(ownerPage)).toBe(secondaryMemberId);
    const publicGroup = await createStudyGroup(
      ownerPage,
      `Convites públicos ${runId}`,
      "PUBLIC"
    );
    if (!publicGroup) {
      throw new Error("The owner-created public QA group was not persisted.");
    }

    await ownerPage.goto(`/comunidade/grupos/${publicGroup.slug}`);
    await openInvitations(ownerPage);
    await ownerPage.getByRole("tab", { name: "Pessoas" }).click();
    await selectInvitee(ownerPage, adminSearch);
    await ownerPage.getByRole("button", { name: "Enviar convites" }).click();
    await expect(
      ownerPage.getByTestId("community-invite-batch-result")
    ).toContainText("Convites enviados.");
    const publicPersonalInvitation = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: publicGroup.id,
      memberIds: [adminId],
    });
    expect(publicPersonalInvitation[0]?.status).toBe("PENDING");

    const adminPage = await adminContext.newPage();
    await profileInvitationResponse(adminPage, publicGroup.title, "Aceitar");
    const publicPersonalMembership = await queryDatabase<{
      id: string;
      role: string;
    } | null>("membership", { spaceId: publicGroup.id, memberId: adminId });
    expect(publicPersonalMembership?.role).toBe("MEMBER");
    const acceptedPublicPersonalInvitation = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: publicGroup.id,
      memberIds: [adminId],
    });
    expect(acceptedPublicPersonalInvitation[0]?.status).toBe("ACCEPTED");

    await ownerPage.goto(`/comunidade/grupos/${publicGroup.slug}`);
    await openInvitations(ownerPage);
    await ownerPage.getByRole("tab", { name: "Link" }).click();
    await ownerPage.getByRole("button", { name: "Criar link" }).click();
    const publicLinkInput = ownerPage.getByRole("textbox", {
      name: "Link de convite",
    });
    await expect(publicLinkInput).toBeVisible();
    const publicLinkUrl = await publicLinkInput.inputValue();
    const publicInviteToken =
      new URL(publicLinkUrl).pathname.split("/").at(-1) ?? "";
    expect(publicInviteToken).toMatch(inviteTokenPattern);

    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(publicLinkUrl);
    await expect(
      anonymousPage.getByRole("heading", {
        name: "Entre para conferir o convite.",
      })
    ).toBeVisible();
    await assertNoGroupMetadata(anonymousPage, [
      publicGroup.title,
      publicGroup.description,
      publicGroup.details,
    ]);
    const signInHref = await anonymousPage
      .getByRole("link", { name: "Entrar para aceitar" })
      .getAttribute("href");
    if (!signInHref) {
      throw new Error("The public invite page did not provide a sign-in link.");
    }
    expect(new URL(signInHref, appUrl).searchParams.get("redirect_url")).toBe(
      `/comunidade/convite/${publicInviteToken}`
    );

    const memberPage = await memberContext.newPage();
    await memberPage.goto(publicLinkUrl);
    await clerk.loaded({ page: memberPage });
    expect(await clerkUserId(memberPage)).toBe(memberId);
    await expect(
      memberPage.getByRole("heading", { name: publicGroup.title })
    ).toBeVisible();
    await expect(
      memberPage.getByRole("article", {
        name: "Prévia do convite para grupo",
      })
    ).toBeVisible();
    await expect(
      memberPage.getByText("Público", { exact: true })
    ).toBeVisible();
    await expect(memberPage.getByText(memberCountPattern)).toBeVisible();
    await expect(
      memberPage.getByText(
        "Você entra como membro e passa a ver as publicações do grupo."
      )
    ).toBeVisible();
    await screenshot(memberPage, "community-invitation-public-link-1280.png");
    await memberPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await memberPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await screenshot(memberPage, "community-invitation-public-link-390.png");
    await memberPage.getByRole("button", { name: "Entrar no grupo" }).click();
    await expect(memberPage).toHaveURL(
      new URL(`/comunidade/grupos/${publicGroup.slug}`, appUrl).toString()
    );
    const publicLinkMembership = await queryDatabase<{
      id: string;
      role: string;
    } | null>("membership", { spaceId: publicGroup.id, memberId });
    expect(publicLinkMembership?.role).toBe("MEMBER");
    const acceptedPublicLinkInvitation = await queryDatabase<
      Array<{ id: string; inviteeId: string; status: string }>
    >("invitation-states", {
      spaceId: publicGroup.id,
      memberIds: [memberId],
    });
    expect(acceptedPublicLinkInvitation[0]?.status).toBe("ACCEPTED");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

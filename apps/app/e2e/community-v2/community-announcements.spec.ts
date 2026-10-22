import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
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
const newAnnouncementPath = /\/admin\/avisos(?:[?#]|$)/;

type DatabaseOperation =
  | "prepare"
  | "announcement"
  | "dismissal"
  | "set-window"
  | "outbox"
  | "cleanup";

const queryDatabase = <T>(
  operation: DatabaseOperation,
  input: Record<string, unknown>
) =>
  new Promise<T>((resolveQuery, rejectQuery) => {
    const child = spawn(
      "bun",
      [
        "--conditions=react-server",
        "e2e/community-v2/community-announcements-db.ts",
      ],
      { cwd: process.cwd(), env: process.env, windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      rejectQuery(
        new Error(`Announcement QA database query timed out (${operation}).`)
      );
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectQuery(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }
      settled = true;
      if (code !== 0) {
        rejectQuery(
          new Error(stderr || `Announcement QA query exited ${code}.`)
        );
        return;
      }
      try {
        resolveQuery(JSON.parse(stdout) as T);
      } catch (error) {
        rejectQuery(error);
      }
    });
    child.stdin.end(JSON.stringify({ operation, input }));
  });

const assertIsolatedQa = () => {
  const databaseUrl = new URL(
    process.env.DATABASE_URL ?? "http://invalid.local"
  );
  const ids = {
    memberId: process.env.COMMUNITY_QA_MEMBER_ID,
    secondaryMemberId: process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID,
    teacherId: process.env.COMMUNITY_QA_TEACHER_ID,
    adminId: process.env.COMMUNITY_QA_ADMIN_ID,
  };
  if (
    runId === "missing-run-id" ||
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    process.env.COMMUNITY_QA_SUITE !== "announcements" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54325" ||
    databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
    Object.values(ids).some((id) => !id) ||
    !process.env.COMMUNITY_QA_ADMIN_EMAIL
  ) {
    throw new Error(
      "Run scripts/community-v2/run-local-qa.ps1 -Suite announcements with the existing Clerk Development accounts."
    );
  }
  return ids as {
    readonly memberId: string;
    readonly secondaryMemberId: string;
    readonly teacherId: string;
    readonly adminId: string;
  };
};

const localDateTime = (deltaMs: number) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(Date.now() + deltaMs))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const screenshot = async (page: Page, filename: string) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(outputDirectory, filename),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  });
};

const createAnnouncement = async (
  adminPage: Page,
  input: {
    readonly title: string;
    readonly body: string;
    readonly audience?: "ALL" | "STAFF" | "SELECTED" | "COHORT";
    readonly recipientId?: string;
    readonly cohortId?: string;
    readonly important?: boolean;
    readonly startsAt?: string;
    readonly endsAt?: string;
  }
) => {
  const form = adminPage.locator("form").filter({
    has: adminPage.locator("#new-announcement-title"),
  });
  await form.locator("#new-announcement-title").fill(input.title);
  await form.locator("#new-announcement-body").fill(input.body);
  await form
    .locator("#new-announcement-audience")
    .selectOption(input.audience ?? "ALL");
  if (input.recipientId) {
    await form.locator("#new-announcement-recipients").fill(input.recipientId);
  }
  if (input.cohortId) {
    await form
      .locator("#new-announcement-cohorts")
      .selectOption(input.cohortId);
  }
  if (input.startsAt) {
    await form.locator("#new-announcement-starts-at").fill(input.startsAt);
  }
  if (input.endsAt) {
    await form.locator("#new-announcement-ends-at").fill(input.endsAt);
  }
  if (input.important) {
    await form
      .getByLabel("Aviso importante no topo do feed da comunidade")
      .check();
  }
  await form.getByRole("button", { name: "Salvar aviso" }).click();
  await expect(
    adminPage.getByRole("heading", { name: input.title, exact: true })
  ).toBeVisible({ timeout: 30_000 });
  const announcement = await queryDatabase<{
    readonly id: string;
    readonly version: number;
  } | null>("announcement", { title: input.title });
  expect(announcement).not.toBeNull();
  return announcement as { readonly id: string; readonly version: number };
};

const openNotices = async (page: Page) => {
  const notices = page.getByRole("button", { name: "Avisos" });
  if ((await notices.count()) === 0) {
    return;
  }
  if ((await notices.getAttribute("aria-expanded")) !== "true") {
    await notices.click();
  }
};

const openAnnouncementEditor = async (card: Locator) => {
  const details = card.locator("details");
  const isOpen = await details.evaluate(
    (element) => (element as HTMLDetailsElement).open
  );
  if (!isOpen) {
    await details.locator("summary").click();
  }
  return details.locator("form");
};

test("integra avisos da Gestão na Comunidade com audiência, versão, janela e autorização", async ({
  browser,
}) => {
  test.setTimeout(480_000);
  await mkdir(outputDirectory, { recursive: true });
  const { adminId, memberId, secondaryMemberId, teacherId } =
    assertIsolatedQa();
  const { cohort, members } = await queryDatabase<{
    readonly cohort: { readonly id: string; readonly name: string };
    readonly members: Array<{
      readonly id: string;
      readonly role: string;
      readonly displayName: string | null;
      readonly profile: {
        readonly displayName: string | null;
        readonly username: string | null;
      } | null;
    }>;
  }>("prepare", { adminId, memberId, secondaryMemberId, teacherId });
  expect(new Set(members.map(({ id }) => id))).toEqual(
    new Set([adminId, memberId, secondaryMemberId, teacherId])
  );

  const adminContext = await browser.newContext({
    storageState: adminStatePath,
  });
  const adminStaleContext = await browser.newContext({
    storageState: adminStatePath,
  });
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
  const visitorContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
  });
  const createdAnnouncementIds: string[] = [];

  try {
    const adminPage = await adminContext.newPage();
    const staleAdminPage = await adminStaleContext.newPage();
    await adminPage.goto("/admin/avisos");
    await clerk.loaded({ page: adminPage });
    expect(await clerkUserId(adminPage)).toBe(adminId);
    await expect(
      adminPage.getByRole("heading", { name: "Uma mensagem, no lugar certo." })
    ).toBeVisible();
    await screenshot(adminPage, "community-v2-stage08-gestao-desktop.png");

    const importantTitle = `Aviso importante ${runId}`;
    const important = await createAnnouncement(adminPage, {
      title: importantTitle,
      body: `Mensagem importante da Comunidade ${runId}.`,
      important: true,
      startsAt: localDateTime(-60_000),
      endsAt: localDateTime(60 * 60_000),
    });
    console.info(`[community-announcements:${runId}] created important notice`);
    createdAnnouncementIds.push(important.id);
    const initialEvidence = await queryDatabase<{
      readonly events: Array<{
        readonly idempotencyKey: string;
        readonly recipients: readonly string[];
        readonly jobs: readonly {
          readonly consumerKey: string;
          readonly status: string;
        }[];
      }>;
      readonly notifications: readonly {
        readonly memberId: string;
        readonly announcementVersion: number | null;
      }[];
    }>("outbox", { announcementId: important.id });
    expect(initialEvidence.events[0]?.idempotencyKey).toContain(
      `${important.id}:v1`
    );
    expect(initialEvidence.events[0]?.recipients).toContain(memberId);
    expect(initialEvidence.events[0]?.recipients).not.toContain(adminId);
    const initialConsumerKeys = initialEvidence.events[0]?.jobs.map(
      ({ consumerKey }) => consumerKey
    );
    expect(initialConsumerKeys).toContain("preview.notifications.create.v1");
    expect(
      initialConsumerKeys?.every((key) => key.startsWith("preview."))
    ).toBe(true);
    expect(initialEvidence.notifications).toContainEqual({
      memberId,
      announcementVersion: 1,
    });

    await staleAdminPage.goto("/admin/avisos");
    await clerk.loaded({ page: staleAdminPage });
    expect(await clerkUserId(staleAdminPage)).toBe(adminId);

    const memberPage = await memberContext.newPage();
    await memberPage.goto("/comunidade");
    await clerk.loaded({ page: memberPage });
    expect(await clerkUserId(memberPage)).toBe(memberId);
    const importantBanner = memberPage.locator(
      `[data-announcement-id="${important.id}"]`
    );
    await expect(importantBanner).toBeVisible();
    await screenshot(memberPage, "community-v2-stage08-community-desktop.png");

    const secondaryPage = await secondaryContext.newPage();
    await secondaryPage.goto("/comunidade");
    await clerk.loaded({ page: secondaryPage });
    expect(await clerkUserId(secondaryPage)).toBe(secondaryMemberId);
    await expect(
      secondaryPage.locator(`[data-announcement-id="${important.id}"]`)
    ).toBeVisible();

    const mobilePage = await memberContext.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto("/comunidade");
    await clerk.loaded({ page: mobilePage });
    await expect(
      mobilePage.locator(`[data-announcement-id="${important.id}"]`)
    ).toBeVisible();
    await screenshot(mobilePage, "community-v2-stage08-community-mobile.png");
    await mobilePage.close();

    await memberPage.goto("/");
    await expect(
      memberPage.getByText(importantTitle, { exact: true })
    ).toHaveCount(0);
    await memberPage.goto("/comunidade");
    await memberPage
      .locator(`[data-announcement-id="${important.id}"]`)
      .getByRole("button", { name: "Entendi" })
      .click();
    await expect(importantBanner).toHaveCount(0);
    const dismissal = await queryDatabase<{
      readonly dismissedAt: Date;
      readonly announcementVersion: number;
    } | null>("dismissal", {
      announcementId: important.id,
      memberId,
      version: 1,
    });
    expect(dismissal?.announcementVersion).toBe(1);
    await memberPage.reload();
    await expect(
      memberPage.locator(`[data-announcement-id="${important.id}"]`)
    ).toHaveCount(0);
    console.info(
      `[community-announcements:${runId}] persisted version 1 dismissal`
    );

    const adminCard = adminPage.locator(
      `[data-admin-announcement-id="${important.id}"]`
    );
    const editForm = await openAnnouncementEditor(adminCard);
    const revisedTitle = `${importantTitle} revisado`;
    await editForm.locator('input[name="title"]').fill(revisedTitle);
    await editForm.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      adminPage.getByRole("heading", { name: revisedTitle, exact: true })
    ).toBeVisible();
    await memberPage.reload();
    const revisedBanner = memberPage.locator(
      `[data-announcement-id="${important.id}"]`
    );
    await expect(revisedBanner).toBeVisible();

    const staleCard = staleAdminPage.locator(
      `[data-admin-announcement-id="${important.id}"]`
    );
    const staleForm = await openAnnouncementEditor(staleCard);
    await staleForm
      .locator('input[name="title"]')
      .fill("Edição concorrente descartada");
    await staleForm.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      staleAdminPage
        .getByRole("status")
        .filter({ hasText: "mudou em outra edição" })
    ).toBeVisible();
    const revisedRecord = await queryDatabase<{
      readonly title: string;
      readonly version: number;
    } | null>("announcement", { title: revisedTitle });
    expect(revisedRecord).toMatchObject({ title: revisedTitle, version: 2 });
    console.info(
      `[community-announcements:${runId}] verified version 2 and stale edit`
    );

    const retargetForm = await openAnnouncementEditor(adminCard);
    console.info(
      `[community-announcements:${runId}] opened editor for audience retarget`
    );
    await retargetForm
      .locator('select[name="audience"]')
      .selectOption("SELECTED");
    await retargetForm
      .locator('input[name="recipientIds"]')
      .fill(secondaryMemberId);
    await retargetForm
      .getByRole("button", { name: "Salvar alterações" })
      .click();
    console.info(`[community-announcements:${runId}] saved audience retarget`);
    await expect(
      adminCard.getByRole("heading", { name: revisedTitle, exact: true })
    ).toBeVisible();
    const retargetedRecord = await queryDatabase<{
      readonly audience: string;
      readonly recipientIds: readonly string[];
      readonly version: number;
    } | null>("announcement", { title: revisedTitle });
    expect(retargetedRecord).toMatchObject({
      audience: "SELECTED",
      recipientIds: [secondaryMemberId],
      version: 3,
    });
    const retargetedOutbox = await queryDatabase<{
      readonly events: readonly {
        readonly idempotencyKey: string;
        readonly recipients: readonly string[];
      }[];
    }>("outbox", { announcementId: important.id });
    expect(
      retargetedOutbox.events.find(({ idempotencyKey }) =>
        idempotencyKey.includes(`${important.id}:v3`)
      )?.recipients
    ).toEqual([secondaryMemberId]);
    console.info(
      `[community-announcements:${runId}] verified version 3 outbox audience`
    );
    await memberPage.reload();
    await expect(
      memberPage.locator(`[data-announcement-id="${important.id}"]`)
    ).toHaveCount(0);
    await secondaryPage.reload();
    await expect(
      secondaryPage.locator(`[data-announcement-id="${important.id}"]`)
    ).toBeVisible();
    console.info(
      `[community-announcements:${runId}] audience change visible only to current target`
    );

    const selectedTitle = `Aviso individual ${runId}`;
    const selected = await createAnnouncement(adminPage, {
      title: selectedTitle,
      body: `Somente o segundo membro recebe ${runId}.`,
      audience: "SELECTED",
      recipientId: secondaryMemberId,
    });
    console.info(
      `[community-announcements:${runId}] created selected-member notice`
    );
    createdAnnouncementIds.push(selected.id);
    await memberPage.reload();
    await openNotices(memberPage);
    await expect(
      memberPage.getByText(selectedTitle, { exact: true })
    ).toHaveCount(0);
    await secondaryPage.reload();
    await openNotices(secondaryPage);
    await expect(
      secondaryPage.getByText(selectedTitle, { exact: true })
    ).toBeVisible();

    const staffTitle = `Aviso da equipe ${runId}`;
    const staffAnnouncement = await createAnnouncement(adminPage, {
      title: staffTitle,
      body: `Somente professores recebem ${runId}.`,
      audience: "STAFF",
    });
    console.info(`[community-announcements:${runId}] created staff notice`);
    createdAnnouncementIds.push(staffAnnouncement.id);
    await memberPage.reload();
    await openNotices(memberPage);
    await expect(memberPage.getByText(staffTitle, { exact: true })).toHaveCount(
      0
    );
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/comunidade");
    await clerk.loaded({ page: teacherPage });
    expect(await clerkUserId(teacherPage)).toBe(teacherId);
    await openNotices(teacherPage);
    await expect(
      teacherPage.getByText(staffTitle, { exact: true })
    ).toBeVisible();

    const cohortTitle = `Aviso da turma ${runId}`;
    const cohortAnnouncement = await createAnnouncement(adminPage, {
      title: cohortTitle,
      body: `Somente a turma QA recebe ${runId}.`,
      audience: "COHORT",
      cohortId: cohort.id,
    });
    console.info(`[community-announcements:${runId}] created cohort notice`);
    createdAnnouncementIds.push(cohortAnnouncement.id);
    await memberPage.reload();
    await openNotices(memberPage);
    await expect(
      memberPage.getByText(cohortTitle, { exact: true })
    ).toBeVisible();
    await secondaryPage.reload();
    await openNotices(secondaryPage);
    await expect(
      secondaryPage.getByText(cohortTitle, { exact: true })
    ).toHaveCount(0);

    const futureTitle = `Aviso agendado ${runId}`;
    const future = await createAnnouncement(adminPage, {
      title: futureTitle,
      body: `Janela futura de QA ${runId}.`,
      important: true,
      startsAt: localDateTime(5 * 60_000),
      endsAt: localDateTime(20 * 60_000),
    });
    console.info(`[community-announcements:${runId}] created scheduled notice`);
    createdAnnouncementIds.push(future.id);
    const futurePage = await memberContext.newPage();
    await futurePage.clock.install({ time: new Date() });
    let pollRequests = 0;
    futurePage.on("request", (request) => {
      if (request.url().includes("/api/community/announcements")) {
        pollRequests += 1;
      }
    });
    await futurePage.goto("/comunidade");
    await clerk.loaded({ page: futurePage });
    await expect(
      futurePage.locator(`[data-announcement-id="${future.id}"]`)
    ).toHaveCount(0);
    await expect.poll(() => pollRequests).toBeGreaterThan(0);
    await futurePage.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenRequestCount = pollRequests;
    await queryDatabase("set-window", {
      announcementId: future.id,
      startsAt: new Date().toISOString(),
    });
    await futurePage.clock.fastForward(61_000);
    await expect.poll(() => pollRequests).toBe(hiddenRequestCount);
    await expect(
      futurePage.locator(`[data-announcement-id="${future.id}"]`)
    ).toHaveCount(0);
    await futurePage.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      futurePage.locator(`[data-announcement-id="${future.id}"]`)
    ).toBeVisible({ timeout: 10_000 });
    console.info(
      `[community-announcements:${runId}] verified visible-tab polling`
    );
    await futurePage.close();

    await queryDatabase("set-window", {
      announcementId: important.id,
      endsAt: new Date().toISOString(),
    });
    await secondaryPage.reload();
    await expect(
      secondaryPage.locator(`[data-announcement-id="${important.id}"]`)
    ).toHaveCount(0);

    const visitorPage = await visitorContext.newPage();
    const apiResponse = await visitorPage.goto("/api/community/announcements");
    expect(apiResponse?.status()).toBe(401);
    await visitorPage.close();

    await memberPage.goto("/admin/avisos");
    await expect(memberPage).not.toHaveURL(newAnnouncementPath);
  } finally {
    await queryDatabase("cleanup", {
      announcementIds: createdAnnouncementIds,
      cohortId: cohort.id,
    });
    await Promise.all([
      adminContext.close(),
      adminStaleContext.close(),
      memberContext.close(),
      secondaryContext.close(),
      teacherContext.close(),
      visitorContext.close(),
    ]);
  }
});

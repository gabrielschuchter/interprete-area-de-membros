import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { adminStatePath, clerkUserId, teacherStatePath } from "./auth-state";
import { authDirectory } from "./auth-state-paths";

const runIdPattern = /^\d{8}-\d{6}-[a-f0-9]{8}$/;
const profileSavedUrlPattern = /\/perfil\?saved=1(?:&|$)/;
const avatarStatusPattern = /online|membros ativos|ativo agora/i;
const goalSavedResultPattern = /resultado=salva/;
const memberMetaRedirectPattern = /\/$/;
const renewalResultPattern = /resultado=(conflito|renovada)/;
const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";
const updatedGoalTitle = `Meta coletiva QA ${runId} — revisada`;
const outputDirectory =
  process.env.COMMUNITY_QA_OUTPUT_DIR ??
  resolve(authDirectory, "results", runId);

type GoalDatabaseOperation =
  | "create-race"
  | "seed-study-records"
  | "set-manual-expired"
  | "expire-automatic"
  | "campaign-state"
  | "avatar-profile-state"
  | "restore-avatar"
  | "cleanup";

const queryGoalDatabase = <T>(
  operation: GoalDatabaseOperation,
  input: Record<string, string>
) =>
  new Promise<T>((resolveQuery, rejectQuery) => {
    const queryProcess = spawn(
      "bun",
      ["--conditions=react-server", "e2e/community-v2/community-goal-db.ts"],
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
  const ids = {
    adminId: process.env.COMMUNITY_QA_ADMIN_ID,
    memberId: process.env.COMMUNITY_QA_MEMBER_ID,
    teacherId: process.env.COMMUNITY_QA_TEACHER_ID,
  };
  if (
    !runIdPattern.test(runId) ||
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54325" ||
    databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
    Object.values(ids).some((id) => !id)
  ) {
    throw new Error(
      "Run the guarded local PostgreSQL and Clerk Development collective-goal QA first."
    );
  }
  return ids as { adminId: string; memberId: string; teacherId: string };
};

const screenshot = async (page: Page, name: string) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(outputDirectory, name),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  });
};

const setCommunityAvatarOptIn = async (page: Page, enabled: boolean) => {
  await page.goto("/perfil/editar");
  const checkbox = page.getByRole("checkbox", {
    name: "Exibir meu avatar no bloco visual da Comunidade",
  });
  await expect(checkbox).toBeVisible();
  if (enabled) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page).toHaveURL(profileSavedUrlPattern);
};

test("persiste a meta, une sessões elegíveis, renova com concorrência e respeita opt-out", async ({
  browser,
  page,
}) => {
  test.setTimeout(360_000);
  const { adminId, memberId, teacherId } = assertLocalQa();
  let campaignId: string | undefined;
  let teacherContext:
    | Awaited<ReturnType<typeof browser.newContext>>
    | undefined;
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let originalAvatarOptIn: boolean | undefined;
  let restoreAvatarOptIn = false;

  try {
    await page.goto("/comunidade");
    await clerk.loaded({ page });
    expect(await clerkUserId(page)).toBe(memberId);
    await expect(
      page.getByText("A meta coletiva ainda não foi configurada.")
    ).toBeVisible();

    const race = await queryGoalDatabase<{
      campaignId: string;
      campaignTitle: string;
      updatedAt: string;
    }>("create-race", {});
    campaignId = race.campaignId;

    await page.goto("/comunidade");
    const goalCard = page.locator(
      '.community-rail__goal[aria-labelledby="community-goal-heading"]:visible'
    );
    await expect(goalCard.getByText("Sem registros")).toBeVisible();
    await expect(
      goalCard.getByText("Ainda não há registros elegíveis neste período.")
    ).toBeVisible();

    const fixture = await queryGoalDatabase<{
      campaignId: string;
      expectedTotalSeconds: number;
      goal: {
        sourceKinds: string[];
        state: string;
        totalSeconds: number;
      };
      lessonId: string;
    }>("seed-study-records", { campaignId });
    expect(fixture.lessonId).toBeTruthy();
    expect(fixture.goal).toEqual({
      sourceKinds: ["LESSON", "PERSONAL_TIMER"],
      state: "active",
      totalSeconds: fixture.expectedTotalSeconds,
    });
    expect(fixture.expectedTotalSeconds).toBe(531);

    await page.goto("/comunidade");
    await expect(goalCard.getByText("Ativa")).toBeVisible();
    await expect(
      goalCard.getByText("Aulas, Cronômetro pessoal.")
    ).toBeVisible();
    await expect(
      page.locator(".community-rail__avatars [data-testid='community-avatars']")
    ).toHaveAttribute("aria-hidden", "true");
    await expect(
      page.locator(".community-rail__avatars").getByText(avatarStatusPattern)
    ).toHaveCount(0);
    await expect(
      page.locator(
        ".community-rail__avatars a, .community-rail__avatars button"
      )
    ).toHaveCount(0);

    for (const width of [390, 820, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/comunidade");
      await expect(goalCard).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowingElements: Array.from(document.body.querySelectorAll("*"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              className:
                typeof element.className === "string" ? element.className : "",
              right: Math.round(rect.right),
              tagName: element.tagName,
              text: element.textContent?.trim().slice(0, 48) ?? "",
            };
          })
          .filter(
            ({ right }) => right > document.documentElement.clientWidth + 1
          )
          .slice(0, 8),
      }));
      expect(
        dimensions.scrollWidth,
        JSON.stringify(dimensions)
      ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await screenshot(page, `community-goal-${width}.png`);
    }

    const beforeProfile = await queryGoalDatabase<{
      eligibleCount: number;
      showInCommunityAvatars: boolean;
    }>("avatar-profile-state", { memberId });
    originalAvatarOptIn = beforeProfile.showInCommunityAvatars;
    restoreAvatarOptIn = true;

    await setCommunityAvatarOptIn(page, true);
    const optedInProfile = await queryGoalDatabase<{
      eligibleCount: number;
      showInCommunityAvatars: boolean;
    }>("avatar-profile-state", { memberId });
    expect(optedInProfile.showInCommunityAvatars).toBe(true);
    expect(optedInProfile.eligibleCount).toBe(
      beforeProfile.eligibleCount +
        (beforeProfile.showInCommunityAvatars ? 0 : 1)
    );

    await setCommunityAvatarOptIn(page, false);
    restoreAvatarOptIn = originalAvatarOptIn;
    const optedOutProfile = await queryGoalDatabase<{
      eligibleCount: number;
      showInCommunityAvatars: boolean;
    }>("avatar-profile-state", { memberId });
    expect(optedOutProfile.showInCommunityAvatars).toBe(false);
    expect(optedOutProfile.eligibleCount).toBe(
      optedInProfile.eligibleCount - 1
    );
    await page.goto("/comunidade");
    await expect(
      page.locator(".community-rail__avatars [data-testid='community-avatars']")
    ).toHaveAttribute("aria-hidden", "true");

    if (originalAvatarOptIn) {
      await setCommunityAvatarOptIn(page, true);
    }
    restoreAvatarOptIn = false;

    teacherContext = await browser.newContext({
      storageState: teacherStatePath,
    });
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/comunidade/meta");
    await clerk.loaded({ page: teacherPage });
    expect(await clerkUserId(teacherPage)).toBe(teacherId);
    await expect(
      teacherPage.getByRole("heading", { name: "Meta coletiva", exact: true })
    ).toBeVisible();
    await teacherPage.getByLabel("Título").fill(updatedGoalTitle);
    await teacherPage.getByLabel("Valor da meta · horas").fill("0.5");
    await teacherPage.getByRole("button", { name: "Salvar meta" }).click();
    await expect(teacherPage).toHaveURL(goalSavedResultPattern);

    adminContext = await browser.newContext({ storageState: adminStatePath });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/comunidade/meta");
    await clerk.loaded({ page: adminPage });
    expect(await clerkUserId(adminPage)).toBe(adminId);
    await expect(adminPage.getByLabel("Título")).toHaveValue(updatedGoalTitle);
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
    await screenshot(adminPage, "community-goal-management-active-1440.png");
    await adminPage.setViewportSize({ width: 390, height: 844 });
    await screenshot(adminPage, "community-goal-management-active-390.png");

    await page.goto("/comunidade/meta");
    await expect(page).toHaveURL(memberMetaRedirectPattern);
    await page.goto("/comunidade");

    const editedState = await queryGoalDatabase<{
      campaign: {
        targetMinutes: number;
        renewalMode: string;
        title: string;
      };
      snapshots: unknown[];
      summary: { state: string; totalSeconds: number };
    }>("campaign-state", { campaignId });
    expect(editedState.campaign.title).toBe(updatedGoalTitle);
    expect(editedState.campaign.targetMinutes).toBe(30);
    expect(editedState.summary).toMatchObject({
      state: "active",
      totalSeconds: fixture.expectedTotalSeconds,
    });

    const expired = await queryGoalDatabase<{
      summary: { state: string; totalSeconds: number; sourceKinds: string[] };
    }>("set-manual-expired", { campaignId });
    expect(expired.summary).toMatchObject({
      state: "ended",
      totalSeconds: 441,
      sourceKinds: ["LESSON", "PERSONAL_TIMER"],
    });

    await Promise.all([
      teacherPage.goto("/comunidade/meta"),
      adminPage.goto("/comunidade/meta"),
    ]);
    await expect(
      teacherPage.getByRole("button", { name: "Salvar histórico e renovar" })
    ).toBeVisible();
    await expect(
      adminPage.getByRole("button", { name: "Salvar histórico e renovar" })
    ).toBeVisible();
    await Promise.all([
      teacherPage
        .getByRole("button", { name: "Salvar histórico e renovar" })
        .click(),
      adminPage
        .getByRole("button", { name: "Salvar histórico e renovar" })
        .click(),
    ]);
    await Promise.all([
      expect(teacherPage).toHaveURL(renewalResultPattern),
      expect(adminPage).toHaveURL(renewalResultPattern),
    ]);
    const renewalResults = [
      new URL(teacherPage.url()).searchParams.get("resultado"),
      new URL(adminPage.url()).searchParams.get("resultado"),
    ].sort();
    expect(renewalResults).toEqual(["conflito", "renovada"]);

    const manualRenewalState = await queryGoalDatabase<{
      campaign: { renewalMode: string };
      snapshots: Array<{
        sourceKinds: string[];
        totalSeconds: number;
      }>;
      summary: { state: string };
    }>("campaign-state", { campaignId });
    expect(manualRenewalState.campaign.renewalMode).toBe("MANUAL");
    expect(manualRenewalState.snapshots).toHaveLength(1);
    expect(manualRenewalState.snapshots[0]).toMatchObject({
      sourceKinds: ["LESSON", "PERSONAL_TIMER"],
      totalSeconds: 441,
    });

    await queryGoalDatabase("expire-automatic", { campaignId });
    await Promise.all([
      page.goto("/comunidade"),
      teacherPage.goto("/comunidade"),
    ]);
    await expect(
      page.locator(".community-rail__goal").getByText("Sem registros")
    ).toBeVisible();

    const automaticState = await queryGoalDatabase<{
      campaign: {
        endsAt: string;
        renewalMode: string;
        startsAt: string;
      };
      snapshots: unknown[];
      summary: { state: string };
    }>("campaign-state", { campaignId });
    expect(automaticState.campaign.renewalMode).toBe("AUTOMATIC");
    expect(new Date(automaticState.campaign.endsAt).getTime()).toBeGreaterThan(
      Date.now()
    );
    expect(
      new Date(automaticState.campaign.startsAt).getTime()
    ).toBeLessThanOrEqual(Date.now());
    expect(automaticState.snapshots).toHaveLength(3);
    expect(automaticState.summary.state).toBe("empty");
  } finally {
    if (restoreAvatarOptIn && originalAvatarOptIn !== undefined) {
      try {
        await setCommunityAvatarOptIn(page, originalAvatarOptIn);
      } catch {
        await queryGoalDatabase("restore-avatar", {
          memberId,
          showInCommunityAvatars: String(originalAvatarOptIn),
        });
      }
    }
    await Promise.all([teacherContext?.close(), adminContext?.close()]);
    if (campaignId) {
      await queryGoalDatabase("cleanup", { campaignId });
    }
  }
});

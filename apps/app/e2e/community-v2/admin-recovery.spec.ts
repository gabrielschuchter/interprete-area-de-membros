import { expect, test } from "@playwright/test";

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";

const recoveryTitle = `Comunidade ${runId} recuperação`;
const adminCommunityPath = /\/admin\/community$/;
const newComposerButtonName = /Escreva uma publicação/;
const newComposerPath = /\/comunidade\/novo\?/;
const publicationPath = /\/comunidade\/publicacoes\//;
const actionResultPattern = /"ok"\s*:\s*(true|false)/;
const actionSuccessPattern = /"ok"\s*:\s*true/;

async function createPublishedPost(
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
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(publicationPath, { timeout: 30_000 });
}

async function deleteLocalPost(
  page: import("@playwright/test").Page,
  title: string
) {
  for (const status of ["published", "drafts"]) {
    await page.goto(
      `/comunidade/minhas-publicacoes?status=${status}&q=${encodeURIComponent(title)}`
    );
    const card = page.locator("article").filter({ hasText: title }).first();
    if ((await card.count()) === 0) {
      continue;
    }
    await card.getByRole("button", { name: "Ações da publicação" }).click();
    await page.getByRole("menuitem", { name: "Excluir", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Excluir", exact: true })
      .click();
    await expect(
      page.locator("article").filter({ hasText: title })
    ).toHaveCount(0);
  }
}

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

test("concurrent staff pin requests leave one publication pinned in the feed scope", async ({
  browser,
  context,
  page,
}) => {
  if (runId === "missing-run-id") {
    throw new Error("Run the guarded local Community V2 QA script first.");
  }
  test.setTimeout(180_000);

  const titles = [
    `Comunidade ${runId} concorrência pin A`,
    `Comunidade ${runId} concorrência pin B`,
  ];
  const listUrl = `/comunidade/minhas-publicacoes?status=published&q=${encodeURIComponent(runId)}`;
  const absoluteListUrl = new URL(
    listUrl,
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101"
  ).toString();
  let previousPinnedPostHref: string | null = null;
  let firstContext: import("@playwright/test").BrowserContext | null = null;
  let secondContext: import("@playwright/test").BrowserContext | null = null;

  try {
    await page.goto("/comunidade");
    const existingPinnedCard = page
      .locator("article.community-post-card--pinned")
      .first();
    if ((await existingPinnedCard.count()) > 0) {
      previousPinnedPostHref = await existingPinnedCard
        .locator("h2 a")
        .getAttribute("href");
      if (!previousPinnedPostHref) {
        throw new Error(
          "Could not capture the existing feed pin for restoration."
        );
      }
    }

    await createPublishedPost(page, titles[0], `Conteúdo ${runId} A`);
    await createPublishedPost(page, titles[1], `Conteúdo ${runId} B`);

    const storageState = await context.storageState({ indexedDB: true });
    firstContext = await browser.newContext({ storageState });
    secondContext = await browser.newContext({ storageState });
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    await Promise.all([
      firstPage.goto(absoluteListUrl),
      secondPage.goto(absoluteListUrl),
    ]);

    const firstCard = firstPage
      .locator("article")
      .filter({ hasText: titles[0] });
    const secondCard = secondPage
      .locator("article")
      .filter({ hasText: titles[1] });
    await Promise.all([
      expect(firstCard).toBeVisible(),
      expect(secondCard).toBeVisible(),
    ]);
    const firstTrigger = firstCard.getByRole("button", {
      name: "Ações da publicação",
    });
    const secondTrigger = secondCard.getByRole("button", {
      name: "Ações da publicação",
    });
    await Promise.all([firstTrigger.click(), secondTrigger.click()]);
    const firstPin = firstPage.getByRole("menuitem", {
      name: "Fixar",
      exact: true,
    });
    const secondPin = secondPage.getByRole("menuitem", {
      name: "Fixar",
      exact: true,
    });
    await Promise.all([
      expect(firstPin).toBeVisible(),
      expect(secondPin).toBeVisible(),
    ]);

    const isPinActionResponse = async (
      response: import("@playwright/test").Response
    ) => {
      const request = response.request();
      if (
        request.method() === "POST" &&
        Boolean(request.headers()["next-action"]) &&
        new URL(response.url()).pathname === "/comunidade/minhas-publicacoes"
      ) {
        const body = await response.text();
        return actionResultPattern.test(body);
      }
      return false;
    };
    const firstActionResponse = firstPage.waitForResponse(isPinActionResponse);
    const secondActionResponse =
      secondPage.waitForResponse(isPinActionResponse);

    // Separate authenticated contexts issue independent Server Action requests.
    await Promise.all([firstPin.click(), secondPin.click()]);
    const pinResponses = await Promise.all([
      firstActionResponse,
      secondActionResponse,
    ]);
    const pinOutcomes = await Promise.all(
      pinResponses.map(async (response) => {
        const body = await response.text();
        return {
          conflict: body.includes("A fixação foi alterada ao mesmo tempo"),
          success: actionSuccessPattern.test(body),
          status: response.status(),
          unavailable: body.includes(
            "Esta publicação não pode mais ser fixada"
          ),
        };
      })
    );
    expect(pinOutcomes).toHaveLength(2);
    expect(
      pinOutcomes.every(
        ({ conflict, status, success, unavailable }) =>
          status === 200 && !unavailable && (success || conflict)
      ),
      `Server Action pin results: ${JSON.stringify(pinOutcomes)}`
    ).toBe(true);
    expect(pinOutcomes.some(({ success }) => success)).toBe(true);
    await Promise.all(
      pinOutcomes.map((outcome, index) =>
        outcome.conflict
          ? expect(
              [firstPage, secondPage][index].getByRole("alert")
            ).toBeVisible()
          : Promise.resolve()
      )
    );
    await Promise.all([
      expect(firstTrigger).toHaveAttribute("aria-expanded", "false"),
      expect(secondTrigger).toHaveAttribute("aria-expanded", "false"),
    ]);

    await page.goto(listUrl);
    const finalFirstCard = page
      .locator("article")
      .filter({ hasText: titles[0] });
    const finalSecondCard = page
      .locator("article")
      .filter({ hasText: titles[1] });
    await Promise.all([
      expect(finalFirstCard).toBeVisible(),
      expect(finalSecondCard).toBeVisible(),
    ]);
    const pinnedCount =
      (await finalFirstCard.getByText("Fixado", { exact: true }).count()) +
      (await finalSecondCard.getByText("Fixado", { exact: true }).count());
    expect(pinnedCount).toBe(1);
  } finally {
    await Promise.all(
      [firstContext, secondContext]
        .filter((value): value is import("@playwright/test").BrowserContext =>
          Boolean(value)
        )
        .map((value) => value.close())
    );

    if (previousPinnedPostHref) {
      await page.goto(previousPinnedPostHref);
      const trigger = page.getByRole("button", { name: "Ações da publicação" });
      if ((await trigger.count().catch(() => 0)) > 0) {
        await trigger.click();
        const restorePin = page.getByRole("menuitem", {
          name: "Fixar",
          exact: true,
        });
        if ((await restorePin.count()) > 0) {
          await restorePin.click();
          await expect(trigger).toHaveAttribute("aria-expanded", "false");
        } else {
          await page.keyboard.press("Escape");
        }
      }
    }

    for (const title of titles) {
      await deleteLocalPost(page, title);
    }
  }
});

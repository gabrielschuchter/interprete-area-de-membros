import { resolve } from "node:path";
import { clerk } from "@clerk/testing/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { adminStatePath, memberStatePath } from "./auth-state-paths";

const outputDirectory = process.env.COMMUNITY_QA_OUTPUT_DIR;
const responsiveWidths = [320, 360, 390, 768, 820, 1024, 1280, 1440] as const;
const captureWidths = [1440, 820, 390] as const;
const exploreMarker = /Explorar|Comunidade/i;
const savedMarker = /Salvos da comunidade/i;
const meetingsMarker = /Encontros/i;
const profileRoutePattern = /\/membros\//;
const profileMarker = /\S/;
const communityRoutePattern = /^\/comunidade\//;
const viewPickerLabel = "Visão da comunidade: Explorar";

const assertLocalQa = () => {
  const databaseUrl = new URL(
    process.env.DATABASE_URL ?? "http://invalid.local"
  );
  if (
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54325" ||
    databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
    !outputDirectory
  ) {
    throw new Error(
      "Run visual captures only with the guarded local PostgreSQL and Clerk Development QA runner."
    );
  }
};

const screenshot = async (page: Page, name: string, fullPage = true) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(outputDirectory ?? ".", name),
    fullPage,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  });
};

const checkResponsiveWidths = async (page: Page, route: string) => {
  const measurements: Array<{ width: number; scrollWidth: number }> = [];
  for (const width of responsiveWidths) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    measurements.push({ width, scrollWidth });
    expect(
      scrollWidth,
      `${route} overflows horizontally at ${width}px`
    ).toBeLessThanOrEqual(width + 1);
  }
  return measurements;
};

const captureRoute = async (
  page: Page,
  route: string,
  filePrefix: string,
  textMarker: RegExp
) => {
  await page.goto(route);
  const main = page.locator("main").first();
  await expect(main).toBeVisible();
  await expect(main).toContainText(textMarker);

  for (const width of captureWidths) {
    await page.setViewportSize({ width, height: 1000 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(
      scrollWidth,
      `${route} overflows horizontally at capture width ${width}px`
    ).toBeLessThanOrEqual(width + 1);
    await screenshot(page, `${filePrefix}-${width}.png`);
  }

  return checkResponsiveWidths(page, route);
};

const captureMobileViewPicker = async (browser: Browser) => {
  const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101";
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    storageState: memberStatePath,
    viewport: { width: 390, height: 1200 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/comunidade");
    await clerk.loaded({ page });
    const trigger = page.getByRole("button", { name: viewPickerLabel });
    await expect(trigger).toBeVisible();
    await trigger.tap();
    const sheet = page.locator(".community-view-sheet");
    await expect(sheet).toBeVisible();
    await expect(
      page.getByRole("dialog", {
        name: "Comunidade",
        description: "Escolha uma das cinco visões da Comunidade.",
      })
    ).toBeVisible();
    await expect(sheet.getByRole("link")).toHaveCount(5);
    await screenshot(page, "community-visual-mobile-views-390.png", false);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  } finally {
    await context.close();
  }
};

test("captura rotas visuais restantes e verifica os oito breakpoints reais", async ({
  browser,
  page,
}) => {
  assertLocalQa();

  const responsive: Record<
    string,
    Array<{ readonly width: number; readonly scrollWidth: number }>
  > = {};
  responsive.explore = await captureRoute(
    page,
    "/comunidade",
    "community-visual-explore",
    exploreMarker
  );
  await captureMobileViewPicker(browser);
  responsive.saved = await captureRoute(
    page,
    "/comunidade/salvos",
    "community-visual-saved",
    savedMarker
  );
  responsive.meetings = await captureRoute(
    page,
    "/comunidade/encontros",
    "community-visual-meetings",
    meetingsMarker
  );

  const adminContext = await browser.newContext({
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101",
    storageState: adminStatePath,
    viewport: { width: 1280, height: 1000 },
  });
  try {
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/comunidade/meta");
    await expect(
      adminPage.getByRole("heading", { name: "Meta coletiva", level: 1 })
    ).toBeVisible();
    await screenshot(adminPage, "community-visual-goal-management-1280.png");
    await adminPage.setViewportSize({ width: 390, height: 1000 });
    await screenshot(adminPage, "community-visual-goal-management-390.png");
    responsive.goalManagement = await checkResponsiveWidths(
      adminPage,
      "/comunidade/meta"
    );
  } finally {
    await adminContext.close();
  }

  await page.goto("/comunidade");
  const postLink = page.locator(".community-post-card h2 a").first();
  await expect(
    postLink,
    "the persisted feed needs a publication to open its discussion"
  ).toBeVisible();
  const postHref = await postLink.getAttribute("href");
  expect(postHref).toMatch(communityRoutePattern);
  await page.goto(postHref ?? "/comunidade");
  await expect(page.locator("main h1")).toBeVisible();
  const profileLink = page.locator(
    '.community-post-author a[href^="/membros/"]'
  );
  await expect(profileLink).toBeVisible();
  const profileHref = await profileLink.getAttribute("href");
  expect(profileHref).toMatch(profileRoutePattern);
  const returnTo = new URL(
    profileHref ?? "/membros",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101"
  ).searchParams.get("returnTo");
  expect(returnTo).toMatch(communityRoutePattern);
  await page.goto(profileHref ?? "/membros");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voltar para a discussão" })
  ).toHaveAttribute("href", returnTo ?? "");
  responsive.profile = await captureRoute(
    page,
    profileHref ?? "/membros",
    "community-visual-profile",
    profileMarker
  );

  await page.goto(postHref ?? "/comunidade");
  await page.locator(`.community-post-author a[href="${profileHref}"]`).click();
  await expect(page).toHaveURL(profileRoutePattern);
  await expect(page.locator("main h1")).toBeVisible();
  const backLink = page.getByRole("link", {
    name: "Voltar para a discussão",
  });
  await expect(backLink).toHaveAttribute("href", returnTo ?? "");
  await backLink.click();
  await expect(page).toHaveURL(
    new URL(
      returnTo ?? "/comunidade",
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3101"
    ).toString()
  );

  expect(Object.keys(responsive)).toEqual([
    "explore",
    "saved",
    "meetings",
    "goalManagement",
    "profile",
  ]);
});

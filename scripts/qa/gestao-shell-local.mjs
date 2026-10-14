// Read-only browser regression against the existing local QA preview.
// Set QA_PLAYWRIGHT_MODULE to the absolute Playwright entry point if not installed.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const accountMenuPattern = /Abrir menu da conta/;
const finishMotion = (locator) =>
  locator.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished)
    );
  });
const { chromium } = await import(
  process.env.QA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href
    : "playwright"
);
await test("R1/R3: local Gestão rail and modal drawer", async () => {
  const base = new URL(process.env.QA_BASE_URL ?? "http://localhost:3000");
  assert(["localhost", "127.0.0.1"].includes(base.hostname), "Local QA only");
  const output = resolve("output/playwright/gestao-v2/shell-navigation");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  const errors = [];
  const origin = "/biblioteca?q=leitura";
  const route = `/gestao/ensino/cursos?from=${encodeURIComponent(origin)}`;

  try {
    for (const width of [1440, 1280, 1024, 820, 390, 320]) {
      for (const motionMode of ["standard"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          hasTouch: width === 1024,
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(new URL(route, base).href);
        await page
          .getByRole("heading", { name: "Cursos e percursos", exact: true })
          .waitFor();
        const welcome = page.getByRole("button", {
          name: "Começar",
          exact: true,
        });
        await welcome.waitFor();
        await welcome.click();
        // Wait for React hydration even when no welcome is displayed.
        await page.getByRole("button", { name: "Criar", exact: true }).click();
        await page.getByRole("menu").waitFor();
        await page.keyboard.press("Escape");

        if (width === 1024) {
          const rail = page.getByRole("button", {
            name: "Abrir páginas de Ensino",
          });
          assert.equal(
            Math.round(
              (await page.locator(".gestao-sidebar").boundingBox()).width
            ),
            72
          );
          await rail.hover();
          await page
            .getByRole("menuitem", { name: "Cursos e percursos" })
            .waitFor();
          await finishMotion(page.getByRole("menu"));
          await page.screenshot({
            path: `${output}/${width}-${motionMode}-rail.png`,
          });
          await page.mouse.move(700, 700);
          await page.getByRole("menu").waitFor({ state: "hidden" });
          // Opening an inactive area must not navigate first.
          const students = page.getByRole("button", {
            name: "Abrir páginas de Alunos",
          });
          await students.focus();
          await page.keyboard.press("ArrowDown");
          const cohorts = page.getByRole("menuitem", {
            name: "Turmas",
            exact: true,
          });
          await cohorts.waitFor();
          assert.equal(
            await cohorts.evaluate(
              (element) => element === document.activeElement
            ),
            true
          );
          assert.equal(
            new URL(await cohorts.getAttribute("href"), base).searchParams.get(
              "from"
            ),
            origin
          );
          await page.keyboard.press("Escape");
          await page.getByRole("menu").waitFor({ state: "hidden" });
          await page.waitForFunction(
            () =>
              document.activeElement?.getAttribute("aria-label") ===
              "Abrir páginas de Alunos"
          );
          assert.equal(
            await students.evaluate(
              (element) => element === document.activeElement
            ),
            true
          );
          // A touch opens the submenu without changing the current route.
          await students.tap();
          await cohorts.waitFor();
          assert.equal(new URL(page.url()).pathname, "/gestao/ensino/cursos");
          await cohorts.click();
          await page.waitForURL("**/gestao/alunos/turmas?**");
          assert.equal(new URL(page.url()).searchParams.get("from"), origin);
          await page
            .getByRole("heading", { name: "Turmas", exact: true })
            .waitFor();
          const teaching = page.getByRole("button", {
            name: "Abrir páginas de Ensino",
          });
          await teaching.focus();
          await page.keyboard.press("ArrowDown");
          await page.getByRole("menu").waitFor();
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.getByRole("menu").waitFor({ state: "hidden" });
          await page.setViewportSize({ width, height: 900 });
        } else if (width < 1024) {
          assert.equal(
            await page.locator(".gestao-sidebar").isVisible(),
            false
          );
          const trigger = page.getByRole("button", {
            name: "Abrir menu",
            exact: true,
          });
          await trigger.focus();
          await page.keyboard.press("Enter");
          const drawer = page.getByRole("dialog", { name: "Menu da Gestão" });
          await drawer.waitFor();
          await finishMotion(drawer);
          assert.equal(Math.round((await drawer.boundingBox()).x), 0);
          assert.equal(
            Math.round((await drawer.boundingBox()).width),
            Math.min(312, width - 48)
          );
          for (let step = 0; step < 22; step++) {
            await page.keyboard.press("Tab");
            assert.equal(
              await drawer.evaluate((element) =>
                element.contains(document.activeElement)
              ),
              true,
              "Tab escaped drawer"
            );
          }
          for (let step = 0; step < 22; step++) {
            await page.keyboard.press("Shift+Tab");
            assert.equal(
              await drawer.evaluate((element) =>
                element.contains(document.activeElement)
              ),
              true,
              "Shift+Tab escaped drawer"
            );
          }
          await page.screenshot({
            path: `${output}/${width}-${motionMode}-drawer.png`,
          });
          await page.keyboard.press("Escape");
          await drawer.waitFor({ state: "hidden" });
          assert.equal(
            await trigger.evaluate(
              (element) => element === document.activeElement
            ),
            true
          );
          await trigger.click();
          await drawer
            .getByRole("button", { name: "Fechar menu", exact: true })
            .click();
          await drawer.waitFor({ state: "hidden" });
          assert.equal(
            await trigger.evaluate(
              (element) => element === document.activeElement
            ),
            true
          );
          await trigger.click();
          await page
            .locator(".gestao-drawer-overlay")
            .click({ position: { x: width - 10, y: 450 } });
          await drawer.waitFor({ state: "hidden" });
          assert.equal(
            await trigger.evaluate(
              (element) => element === document.activeElement
            ),
            true
          );
          await trigger.click();
          await drawer
            .getByRole("button", { name: accountMenuPattern })
            .click();
          await page.getByRole("menuitem", { name: "Meu perfil" }).waitFor();
          assert.equal(
            await drawer.isVisible(),
            true,
            "Opening account menu closed drawer"
          );
          await page.keyboard.press("Escape");
          assert.equal(
            await drawer.isVisible(),
            true,
            "Nested menu closed drawer"
          );
          await page.getByRole("menu").waitFor({ state: "hidden" });
          await page.keyboard.press("Escape");
          await drawer.waitFor({ state: "hidden" });
          await trigger.click();
          await page.setViewportSize({ width: 1280, height: 900 });
          await drawer.waitFor({ state: "hidden" });
          assert.equal(
            await page
              .locator(".gestao-sidebar")
              .evaluate((element) => element.contains(document.activeElement)),
            true
          );
          await page.setViewportSize({ width, height: 900 });
          await trigger.click();
          const returnLink = drawer.getByRole("link", {
            name: "Voltar à área de membros",
          });
          assert.equal(await returnLink.getAttribute("href"), origin);
          await drawer
            .getByRole("link", { name: "Exercícios", exact: true })
            .click();
          await page.waitForURL("**/gestao/ensino/exercicios?**");
          await drawer.waitFor({ state: "hidden" });
          assert.equal(new URL(page.url()).searchParams.get("from"), origin);
        } else {
          assert.equal(await page.locator(".gestao-sidebar").isVisible(), true);
          assert.equal(
            await page
              .getByRole("button", { name: "Abrir páginas de Ensino" })
              .isVisible(),
            false
          );
          assert.equal(
            await page
              .getByRole("link", { name: "Voltar à área de membros" })
              .getAttribute("href"),
            origin
          );
          await page.screenshot({
            path: `${output}/${width}-${motionMode}-desktop.png`,
          });
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          ),
          true,
          "Horizontal overflow"
        );
        results.push({ width, motionMode, passed: true });
        await context.close();
      }
    }
    assert.deepEqual(errors, [], "Browser page errors");
  } finally {
    await writeFile(
      `${output}/results.json`,
      JSON.stringify({ results, errors }, null, 2)
    );
    await browser.close();
  }
  console.log(
    `R1/R3 local shell: ${results.length}/12 viewport/motion cases passed`
  );
});

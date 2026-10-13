// Read-only N2/N3 regression. Uses the existing local persisted QA actor.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { chromium } = await import(
  process.env.QA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const base = new URL(process.env.QA_BASE_URL ?? "http://localhost:3000");
assert(["localhost", "127.0.0.1"].includes(base.hostname), "Local QA only");
const output = resolve("output/playwright/gestao-v2/shell-entry");
const origin = "/biblioteca?q=leitura#retomar";
const cohortHeading = /Mentoria/;
const openMemberMenu = async (page) => {
  const entry = page.getByRole("link", { name: "Gestão", exact: true });
  const visible = await entry.isVisible();
  const box = visible ? await entry.boundingBox() : null;
  if (!(visible && box) || box.x < 0) {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !==
              Number.POSITIVE_INFINITY
          )
          .map((animation) => animation.finished.catch(() => undefined))
      );
    });
  }
  return entry;
};
const openGestaoMenu = async (page, width) => {
  if (width < 1024) {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  }
};
const assertNoOverflow = async (page) =>
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    "No horizontal overflow"
  );

await test("N2/N3: entry, source session, reload, return, offline and fallback", async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  const errors = [];
  try {
    for (const width of process.env.QA_WIDTH
      ? [Number(process.env.QA_WIDTH)]
      : [1440, 1280, 1024, 820, 390, 320]) {
      for (const reducedMotion of ["no-preference", "reduce"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion,
        });
        await context.addInitScript(() => {
          localStorage.setItem(
            "interprete:gestao:welcome:v1:gestao_qa_visual_admin",
            "seen"
          );
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15_000);
        page.on("close", () =>
          process.stdout.write(`Finished ${width}/${reducedMotion}\n`)
        );
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(new URL(origin, base).href);
        await page
          .getByRole("heading", { name: "Biblioteca Interprete." })
          .waitFor();
        // The member sidebar settles its media-query mode after hydration.
        if (width < 768) {
          await page
            .locator(".member-area-sidebar")
            .waitFor({ state: "detached" });
        } else if (width < 1024) {
          await page
            .locator('.member-area-sidebar[aria-hidden="true"]')
            .waitFor();
        }
        const entry = await openMemberMenu(page);
        await page.evaluate(() => {
          window.shellEntryEvents = [];
          for (const name of ["keydown", "click", "focusin"]) {
            document.addEventListener(
              name,
              (event) =>
                window.shellEntryEvents.push({
                  name,
                  tag: event.target?.tagName,
                  href: event.target?.closest?.("a")?.getAttribute("href"),
                  label: event.target?.getAttribute?.("aria-label"),
                }),
              true
            );
          }
          window.shellEntryTiming = { start: null, feedbackMs: null, cls: 0 };
          const nativeTransition = document.startViewTransition.bind(document);
          document.startViewTransition = (update) => {
            const transition = nativeTransition(update);
            transition.ready
              .then(() => {
                window.shellEntryTiming.animationDuration = getComputedStyle(
                  document.documentElement,
                  "::view-transition-new(main-content)"
                ).animationDuration;
              })
              .catch((error) => {
                window.shellEntryTiming.snapshotSkipped = error.name;
              });
            return transition;
          };
          document.addEventListener(
            "keydown",
            (event) => {
              if (event.key === "Enter") {
                window.shellEntryTiming.start = performance.now();
              }
            },
            { once: true }
          );
          const observer = new MutationObserver(() => {
            if (
              document.querySelector("output.shell-navigation-feedback") &&
              window.shellEntryTiming.start !== null
            ) {
              window.shellEntryTiming.feedbackMs =
                performance.now() - window.shellEntryTiming.start;
              observer.disconnect();
            }
          });
          observer.observe(document.body, { subtree: true, childList: true });
          const shifts = new PerformanceObserver((list) => {
            for (const item of list.getEntries()) {
              if (
                window.shellEntryTiming.start !== null &&
                !item.hadRecentInput
              ) {
                window.shellEntryTiming.cls += item.value;
              }
            }
          });
          shifts.observe({ type: "layout-shift" });
          window.stopShellEntryMeasurement = () => shifts.disconnect();
        });
        await entry.focus();
        // Focus starts intentional prefetch; let its React commit settle before
        // the browser synthesizes activation on the current anchor node.
        await page.evaluate(
          () =>
            new Promise((resolveFrame) =>
              requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
            )
        );
        assert(
          await entry.evaluate((element) => element === document.activeElement),
          "Entry retains keyboard focus"
        );
        await page.keyboard.press("Enter");
        await page
          .getByRole("heading", { name: "Visão geral", exact: true })
          .waitFor()
          .catch(async (error) => {
            await page.screenshot({
              path: `${output}/${width}-${reducedMotion}-failure.png`,
            });
            await writeFile(
              `${output}/failure.json`,
              JSON.stringify(
                await page.evaluate(() => ({
                  path: location.pathname,
                  focused: document.activeElement?.tagName,
                  title: document.querySelector("h1")?.textContent,
                  status: document.querySelector(".shell-navigation-feedback")
                    ?.textContent,
                  dialog: !!document.querySelector('[role="dialog"]'),
                  events: window.shellEntryEvents,
                })),
                null,
                2
              )
            );
            throw error;
          });
        await page.waitForFunction(
          () =>
            document.querySelector("[data-shell-announcement]")?.textContent ===
            "Você está na Gestão"
        );
        assert.equal(new URL(page.url()).searchParams.get("from"), origin);
        await page.waitForFunction(
          () => document.activeElement?.tagName === "H1"
        );
        await assertNoOverflow(page);
        await page.evaluate(async () => {
          await Promise.all(
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.effect?.getTiming().iterations !==
                  Number.POSITIVE_INFINITY
              )
              .map((animation) => animation.finished.catch(() => undefined))
          );
          window.stopShellEntryMeasurement();
        });
        const timing = await page.evaluate(() => window.shellEntryTiming);
        assert(
          timing.feedbackMs !== null && timing.feedbackMs <= 100,
          `Feedback ${timing.feedbackMs} ms`
        );
        assert.equal(
          timing.animationDuration,
          reducedMotion === "reduce" ? "0.12s" : "0.4s"
        );
        await page.screenshot({
          path: `${output}/${width}-${reducedMotion}-arrival.png`,
        });

        // Navigate through the shell, then through a content link without `from`.
        await openGestaoMenu(page, width);
        if (width === 1024) {
          await page
            .getByRole("button", { name: "Abrir páginas de Alunos" })
            .click();
          await page
            .getByRole("menuitem", { name: "Turmas", exact: true })
            .click();
        } else {
          await page.getByRole("link", { name: "Alunos", exact: true }).click();
          await page
            .getByRole("heading", { name: "Turmas", exact: true })
            .waitFor();
        }
        await page
          .getByRole("heading", { name: "Turmas", exact: true })
          .waitFor();
        const detail = page
          .locator('a[href="/gestao/alunos/turmas/cmv5no8ih0024kgyp2ew3ouke"]')
          .first();
        await detail.click();
        await page.waitForURL(
          "**/gestao/alunos/turmas/cmv5no8ih0024kgyp2ew3ouke"
        );
        assert.equal(new URL(page.url()).searchParams.has("from"), false);
        await page.reload();
        await page.getByRole("heading", { name: cohortHeading }).waitFor();
        await openGestaoMenu(page, width);
        const back = page.getByRole("link", {
          name: "Voltar à área de membros",
          exact: true,
        });
        await page.waitForFunction(
          (expected) =>
            document
              .querySelector(".gestao-back-link")
              ?.getAttribute("href") === expected,
          origin
        );
        assert.equal(await back.getAttribute("href"), origin);
        await back.click();
        await page.waitForURL(new URL(origin, base).href);
        await page.waitForFunction(
          () =>
            document.querySelector("[data-shell-announcement]")?.textContent ===
            "Você voltou à área de membros"
        );
        await page.waitForFunction(
          () => document.activeElement?.tagName === "H1"
        );
        await assertNoOverflow(page);
        results.push({
          width,
          reducedMotion,
          sourceAfterReload: origin,
          entryAndReturn: "PASS",
          timing,
        });
        await context.close();
      }
    }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(() => {
      localStorage.setItem(
        "interprete:gestao:welcome:v1:gestao_qa_visual_admin",
        "seen"
      );
      Object.defineProperty(document, "startViewTransition", {
        value: undefined,
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL(origin, base).href);
    await page
      .getByRole("heading", { name: "Biblioteca Interprete." })
      .waitFor();
    await context.setOffline(true);
    await (await openMemberMenu(page)).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Não foi possível abrir" })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, "/biblioteca");
    assert(
      await page
        .getByRole("heading", { name: "Biblioteca Interprete." })
        .isVisible()
    );
    await page.screenshot({ path: `${output}/offline-preserved.png` });
    await context.setOffline(false);
    await page
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Visão geral", exact: true })
      .waitFor();
    await page.waitForFunction(() => document.activeElement?.tagName === "H1");
    results.push({
      fallbackWithoutViewTransitions: "PASS",
      offlineAndRetry: "PASS",
    });
    await context.close();
    assert.deepEqual(errors, []);
  } finally {
    await writeFile(
      `${output}/results.json`,
      JSON.stringify({ results, errors }, null, 2)
    );
    await browser.close();
  }
});

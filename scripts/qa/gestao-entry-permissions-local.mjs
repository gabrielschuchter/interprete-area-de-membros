// Owns only the dev processes it starts. Stop the existing preview first.
// Finally restores the visual-admin preview. No fixture or role writes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sequential actor matrix owns and restores one local server; explicit branches keep denial assertions reviewable.
await test("N1: persisted local actors and server denials", async () => {
  assert.equal(
    process.platform,
    "win32",
    "This local process harness targets Windows"
  );
  const root = process.cwd();
  const output = resolve("output/playwright/gestao-v2/entry-permissions");
  await mkdir(output, { recursive: true });
  const base = "http://localhost:3000";
  try {
    await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) });
    throw new Error("Stop the existing preview before running this harness");
  } catch (error) {
    if (error.message.startsWith("Stop the existing")) {
      throw error;
    }
  }
  const ca = resolve(
    process.env.TEMP,
    "interprete-gestao-qa-20261012/local-qa-ca.crt"
  );
  const { default: pg } = await import(
    pathToFileURL(resolve("packages/database/node_modules/pg/lib/index.js"))
      .href
  );
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 55_433,
    user: "postgres",
    database: "interprete_gestao_qa_20261012",
    ssl: { ca: readFileSync(ca, "utf8"), rejectUnauthorized: true },
  });
  await client.connect();
  let cohorts;
  try {
    const tls = await client.query(
      "SELECT current_database() AS db, ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
    );
    assert.equal(tls.rows[0].db, "interprete_gestao_qa_20261012");
    assert.equal(tls.rows[0].ssl, true);
    cohorts = (
      await client.query(
        'SELECT c.id, c.name, t."memberId" AS teacher FROM "Cohort" c JOIN "CohortTeacher" t ON t."cohortId" = c.id WHERE t."memberId" IN ($1, $2) ORDER BY c.id LIMIT 20',
        ["gestao_qa_functional_teacher_1", "gestao_qa_functional_teacher_2"]
      )
    ).rows;
    assert(cohorts.some((cohort) => cohort.teacher.endsWith("teacher_1")));
    assert(cohorts.some((cohort) => cohort.teacher.endsWith("teacher_2")));
  } finally {
    await client.end();
  }
  const bun = resolve(process.env.USERPROFILE, ".bun/bin/bun.exe");
  const start = (actor, profile = "functional") => {
    assert(["admin", "teacher_1", "teacher_2", "student_01"].includes(actor));
    assert(["functional", "visual"].includes(profile));
    const database =
      profile === "visual"
        ? "interprete_gestao_visual_qa_20261012"
        : "interprete_gestao_qa_20261012";
    const databaseUrl = `postgresql://postgres@127.0.0.1:55433/${database}?connection_limit=2`;
    const fd = openSync(`${output}/${profile}-${actor}-server.log`, "a");
    const child = spawn(bun, ["run", "--cwd", "apps/app", "dev"], {
      cwd: root,
      windowsHide: true,
      detached: true,
      stdio: ["ignore", fd, fd],
      env: {
        ...process.env,
        NODE_ENV: "development",
        NODE_OPTIONS: "--use-system-ca",
        SKIP_ENV_VALIDATION: "true",
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
        DATABASE_CA_CERT_PATH: ca,
        GESTAO_DEV_AUTH: "true",
        NEXT_PUBLIC_GESTAO_DEV_AUTH: "true",
        GESTAO_DEV_AUTH_USER_ID: `gestao_qa_${profile}_${actor}`,
        GESTAO_V2_ENABLED: "true",
        NEXT_PUBLIC_APP_URL: base,
        NEXT_PUBLIC_API_URL: "http://localhost:3001",
      },
    });
    closeSync(fd);
    return child;
  };
  const ready = async (child) => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      assert.equal(child.exitCode, null, "Owned QA server exited early");
      try {
        const response = await fetch(`${base}/health`, {
          signal: AbortSignal.timeout(1500),
        });
        const health = await response.json();
        if (health.checks?.database === "ok") {
          return;
        }
      } catch {
        /* Local server is still starting. */
      }
      await delay(500);
    }
    throw new Error("Owned QA server did not become ready");
  };
  const stop = async (child) => {
    if (!child || child.exitCode !== null) {
      return;
    }
    // PID comes exclusively from spawn above; never enumerate or kill other apps.
    await new Promise((resolveStop, reject) => {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" }
      );
      killer.on("error", reject);
      killer.on("exit", resolveStop);
    });
  };
  const { chromium } = await import(
    process.env.QA_PLAYWRIGHT_MODULE
      ? pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href
      : "playwright"
  );
  const browser = await chromium.launch();
  const results = [];
  let owned;
  try {
    for (const actor of ["admin", "teacher_1", "teacher_2", "student_01"]) {
      owned = start(actor);
      await ready(owned);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      await context.addInitScript(
        (key) =>
          localStorage.setItem(`interprete:gestao:welcome:v1:${key}`, "seen"),
        `gestao_qa_functional_${actor}`
      );
      // Keep the browser run confined to local QA, including analytics/assets.
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return ["localhost", "127.0.0.1"].includes(url.hostname)
          ? route.continue()
          : route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/biblioteca`);
      await page
        .getByRole("heading", { name: "Biblioteca Interprete." })
        .waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Gestão", exact: true }).count(),
        actor === "student_01" ? 0 : 1
      );
      const entry = await page.goto(`${base}/gestao`);
      assert.equal(entry.status(), actor === "student_01" ? 403 : 200);
      await page
        .getByRole("heading", {
          name:
            actor === "student_01"
              ? "Você não tem acesso a esta área."
              : "Visão geral",
          exact: true,
        })
        .waitFor();
      results.push({
        actor,
        path: "/gestao",
        status: entry.status(),
        rendered: actor === "student_01" ? "DENIED" : "ALLOWED",
      });
      if (actor === "student_01") {
        await page
          .getByRole("link", { name: "Voltar à área de membros", exact: true })
          .click();
        await page.waitForURL(`${base}/estudar`);
      } else {
        for (const cohort of cohorts) {
          const allowed =
            actor === "admin" ||
            cohort.teacher === `gestao_qa_functional_${actor}`;
          const response = await page.goto(
            `${base}/gestao/alunos/turmas/${cohort.id}`
          );
          assert.equal(response.status(), allowed ? 200 : 403);
          await page
            .getByRole("heading", {
              name: allowed ? cohort.name : "Você não tem acesso a esta área.",
              exact: true,
            })
            .waitFor();
          if (!allowed) {
            assert(
              !(await response.text()).includes(cohort.name),
              "Denied cohort name must not be serialized"
            );
          }
          results.push({
            actor,
            resource: cohort.id,
            status: response.status(),
            rendered: allowed ? "ALLOWED" : "DENIED",
          });
        }
      }
      const response = await page.goto(`${base}/gestao/administracao`);
      const denied = actor !== "admin";
      assert.equal(response.status(), denied ? 403 : 200);
      await page
        .getByRole("heading", {
          name: denied
            ? "Um espaço reservado à direção da escola."
            : "Administração",
          exact: true,
        })
        .waitFor();
      assert.equal(
        new URL(page.url()).pathname,
        "/gestao/administracao",
        "No redirect cycle"
      );
      if (denied) {
        const blockedWrite = await context.request.post(
          `${base}/gestao/administracao`,
          {
            headers: { "Next-Action": "qa-denied-before-action-dispatch" },
            data: [],
          }
        );
        assert.equal(blockedWrite.status(), 403);
        assert(blockedWrite.headers()["cache-control"].includes("no-store"));
        assert(
          !(await response.text()).includes("Configurações da Gestão"),
          "No administrative page payload"
        );
        for (const width of [1440, 1280, 1024, 820, 390, 320]) {
          for (const reducedMotion of ["no-preference", "reduce"]) {
            await page.setViewportSize({ width, height: 900 });
            await page.emulateMedia({ reducedMotion });
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
              )
            );
            await page.screenshot({
              path: `${output}/${actor}-${width}-${reducedMotion}.png`,
            });
          }
        }
        const help = page.getByRole("button", {
          name: "Conhecer o que a administração faz",
        });
        await help.click();
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        assert(
          await help.evaluate((element) => element === document.activeElement)
        );
      }
      results.push({
        actor,
        path: "/gestao/administracao",
        status: response.status(),
        rendered: denied ? "DENIED" : "ALLOWED",
        errors,
      });
      assert.deepEqual(errors, []);
      await context.close();
      await stop(owned);
      owned = null;
      process.stdout.write(`Verified ${actor}\n`);
    }
  } catch (error) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        process.stdout.write(
          `${JSON.stringify({ path: new URL(page.url()).pathname, headings: await page.getByRole("heading").allTextContents() })}\n`
        );
        await page.screenshot({ path: `${output}/failed-state.png` });
      }
    }
    throw error;
  } finally {
    await browser.close();
    await stop(owned);
    const preview = start("admin", "visual");
    await ready(preview);
    preview.unref();
    await writeFile(
      `${output}/results.json`,
      JSON.stringify({ results, restoredPreviewPid: preview.pid }, null, 2)
    );
  }
});

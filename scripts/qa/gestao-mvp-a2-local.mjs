// Explicit local UI journey. Additive fixture; resume never resubmits feedback.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const savedPattern = /resultado=salva/;
const publishedPattern = /resultado=publicada/;
const draftPattern = /resultado=rascunho-salvo/;
const expectedDeniedResource = /Failed to load resource.*(?:403|404)/;
const qaDistDir = process.env.QA_MVP_A2_DIST_DIR ?? ".next-local-a2";

await test("A2 local: private draft, resume and next filtered pending submission", async () => {
  assert.equal(process.platform, "win32");
  assert.equal(process.env.QA_MVP_A2_WRITE, "true");
  const base = "http://localhost:3002";
  const output = resolve("output/playwright/gestao-v2/mvp-a2-round2");
  const slug = "gestao-qa-mvp-a2-20261013-2";
  const title = "QA local — A2 correção contínua 20261013 rodada 2";
  const comment = "QA local — A2 revisão enviada 20261013 rodada 2";
  const answer = "QA local — resposta da jornada MVP 20261013";
  const teacher = "gestao_qa_functional_teacher_1";
  const student = "gestao_qa_functional_student_04";
  const outsider = "gestao_qa_functional_student_12";
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
  await mkdir(output, { recursive: true });
  await client.connect();
  const tls = (
    await client.query(
      "SELECT current_database() AS db,ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    )
  ).rows[0];
  assert.equal(tls.db, "interprete_gestao_qa_20261012");
  assert.equal(tls.ssl, true);
  const cohort = (
    await client.query(
      `SELECT c.id,c.name FROM "Cohort" c JOIN "CohortTeacher" t ON t."cohortId"=c.id JOIN "CohortMembership" cm ON cm."cohortId"=c.id
 WHERE t."memberId"=$1 AND cm."memberId"=$2 AND cm.status='ACTIVE' AND cm."leftAt" IS NULL AND c."archivedAt" IS NULL AND c."startsAt"<CURRENT_TIMESTAMP AND (c."endsAt" IS NULL OR c."endsAt">CURRENT_TIMESTAMP)
 AND NOT EXISTS(SELECT 1 FROM "CohortMembership" other WHERE other."cohortId"=c.id AND other."memberId"=$3 AND other.status='ACTIVE' AND other."leftAt" IS NULL)
 AND NOT EXISTS(SELECT 1 FROM "CohortTeacher" other WHERE other."cohortId"=c.id AND other."memberId"='gestao_qa_functional_teacher_2') LIMIT 1`,
      [teacher, student, outsider]
    )
  ).rows[0];
  assert(cohort, "Existing active, isolated cohort fixture required");
  const preserved = async () =>
    (
      await client.query(
        `SELECT s.status,md5(s.content) AS answer,f.version,md5(f.content) AS feedback,f."teacherId" FROM "ActivitySubmission" s JOIN "Feedback" f ON f."submissionId"=s.id WHERE s.id='cmv5mu61d001sowypj5169jnx'`
      )
    ).rows;
  const originalFeedback = await preserved();
  const otherFeedback = async () =>
    (
      await client.query(
        `SELECT s.id,s.status,f.version,md5(f.content) AS hash,f."criteriaScores",f."teacherId",f."submittedAt" FROM "ActivitySubmission" s JOIN "Activity" a ON a.id=s."activityId" JOIN "Feedback" f ON f."submissionId"=s.id WHERE a.slug<>$1 ORDER BY s.id`,
        [slug]
      )
    ).rows;
  const historyBefore = await otherFeedback();
  const activity = async () =>
    (
      await client.query(
        'SELECT id,status,"rubricVersion",version FROM "Activity" WHERE slug=$1',
        [slug]
      )
    ).rows[0];
  const results = [];
  const pageErrors = [];
  const consoleErrors = [];
  let owned;
  let actorNow;
  let browser;
  let page;
  const start = async (actor, profile = "functional") => {
    assert(
      [
        "teacher_1",
        "teacher_2",
        "student_04",
        "student_02",
        "student_12",
        "admin",
      ].includes(actor)
    );
    assert(["functional", "visual"].includes(profile));
    if (owned && actorNow === actor) {
      return;
    }
    if (owned) {
      await stop();
    }
    try {
      await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
      throw new Error(
        "Stop existing preview before QA; do not kill unowned processes"
      );
    } catch (error) {
      if (error.message.startsWith("Stop existing")) {
        throw error;
      }
    }
    const fd = openSync(`${output}/${profile}-${actor}.log`, "a");
    const db =
      profile === "functional"
        ? "interprete_gestao_qa_20261012"
        : "interprete_gestao_visual_qa_20261012";
    const databaseUrl = `postgresql://postgres@127.0.0.1:55433/${db}?connection_limit=2`;
    owned = spawn(
      process.execPath,
      [
        "scripts/run-next-with-system-ca.mjs",
        "dev",
        "--webpack",
        "-p",
        "3002",
        "--hostname",
        "127.0.0.1",
      ],
      {
        cwd: resolve("apps/app"),
        windowsHide: true,
        detached: false,
        stdio: ["ignore", fd, fd],
        env: {
          ...process.env,
          INTERPRETE_LOCAL_DIST_DIR: qaDistDir,
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
      }
    );
    closeSync(fd);
    actorNow = actor;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      assert.equal(owned.exitCode, null);
      try {
        const health = await fetch(`${base}/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if ((await health.json()).checks?.database === "ok") {
          return;
        }
      } catch {
        /* Starting owned local runtime. */
      }
      await delay(500);
    }
    throw new Error("Owned QA server not ready");
  };
  const stop = async () => {
    if (!owned) {
      return;
    }
    const child = owned;
    owned = null;
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    await new Promise((done, reject) => {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" }
      );
      killer.on("error", reject);
      killer.on("exit", done);
    });
  };
  const visit = async (actor, path) => {
    await page?.context().close();
    await start(actor);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(
      (id) =>
        localStorage.setItem(`interprete:gestao:welcome:v1:${id}`, "seen"),
      `gestao_qa_functional_${actor}`
    );
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !expectedDeniedResource.test(message.text())
      ) {
        consoleErrors.push(message.text());
      }
    });
    page.setDefaultTimeout(40_000);
    page.setDefaultNavigationTimeout(90_000);
    const response = await page.goto(`${base}${path}`);
    await response.text();
    return response;
  };
  const waitForFeedbackHydration = async () => {
    await page.locator(".gc-feedback-form textarea").waitFor();
    await page.waitForFunction(() => {
      const node = document.querySelector(".gc-feedback-form textarea");
      return (
        node && Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      );
    });
  };
  const smoke = async (label) => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        ),
        `${label} overflow at ${width}`
      );
      await page.screenshot({
        path: `${output}/${label}-${width}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  };
  try {
    const { chromium } = await import(
      process.env.QA_PLAYWRIGHT_MODULE
        ? pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href
        : "playwright"
    );
    browser = await chromium.launch({
      executablePath: process.env.QA_CHROMIUM_EXECUTABLE || undefined,
    });
    let currentActivity = await activity();
    if (!currentActivity) {
      await visit("teacher_1", "/gestao/ensino/atividades/nova");
      await page.getByLabel("Título da atividade", { exact: true }).fill(title);
      await page.getByLabel("Endereço", { exact: true }).fill(slug);
      await page
        .getByLabel("Enunciado", { exact: true })
        .fill("QA local: explique uma hipótese e indique sua evidência.");
      await page.locator('[name="rubricTitle"]').nth(0).fill("Raciocínio");
      await page.locator('[name="rubricWeight"]').nth(0).fill("60");
      await page.locator('[name="rubricTitle"]').nth(1).fill("Evidência");
      await page.locator('[name="rubricWeight"]').nth(1).fill("40");
      await page.locator(`[name="cohortIds"][value="${cohort.id}"]`).check();
      const deadline = new Date(Date.now() + 7 * 86_400_000)
        .toISOString()
        .slice(0, 16);
      await page.getByLabel("Prazo de entrega", { exact: true }).fill(deadline);
      await smoke("editor");
      await page
        .getByRole("button", { name: "Salvar rascunho", exact: true })
        .click();
      await page.waitForURL(savedPattern);
      currentActivity = await activity();
      assert.equal(currentActivity?.status, "DRAFT");
      results.push("teacher-created-draft");
    }
    if (currentActivity.status === "DRAFT") {
      await visit("student_12", `/atividades/${slug}`);
      await page.getByRole("heading").first().waitFor();
      assert.equal(
        await page.getByRole("heading", { name: title, exact: true }).count(),
        0
      );
      results.push("draft-hidden-from-outsider");
      await visit(
        "teacher_1",
        `/gestao/ensino/atividades/${currentActivity.id}`
      );
      await page
        .getByRole("button", { name: "Publicar atividade", exact: true })
        .click();
      await page.waitForURL(publishedPattern);
      await page.reload();
      currentActivity = await activity();
      assert.equal(currentActivity.status, "PUBLISHED");
      assert.equal(currentActivity.rubricVersion, 1);
      results.push("teacher-published-reload");
    }
    const lookup = async (memberId) =>
      (
        await client.query(
          `SELECT s.id,s.status,s."submittedAt",s."updatedAt",s."rubricVersion",f.content AS feedback,f.version,f."criteriaScores",d.content AS draft,d.version AS "draftVersion",d."criteriaScores" AS "draftScores" FROM "ActivitySubmission" s JOIN "Activity" a ON a.id=s."activityId" LEFT JOIN "Feedback" f ON f."submissionId"=s.id LEFT JOIN "ActivityFeedbackDraft" d ON d."submissionId"=s.id WHERE a.slug=$1 AND s."memberId"=$2`,
          [slug, memberId]
        )
      ).rows[0];
    for (const actor of ["student_04", "student_02"]) {
      await visit(actor, `/atividades/${slug}`);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      if (!(await lookup(`gestao_qa_functional_${actor}`))) {
        await page
          .getByRole("textbox", { name: "O que você pensa?" })
          .fill(`${answer} ${actor}`);
        await page
          .getByRole("button", { name: "Enviar resposta", exact: true })
          .click();
        await page
          .getByText("Resposta enviada e salva.", { exact: true })
          .waitFor();
      }
    }
    const first = await lookup(student);
    const second = await lookup("gestao_qa_functional_student_02");
    assert(first && second);
    const queue = `/gestao/ensino/atividades/${currentActivity.id}/entregas?turma=${cohort.id}&q=A2`;
    const draftText = "QA local — A2 rascunho privado 20261013 rodada 2";
    if (first.status !== "REVIEWED") {
      await visit("teacher_1", `${queue}&entrega=${first.id}`);
      const box = page.getByRole("textbox", { name: "Comentário ao aluno" });
      await box.waitFor();
      await waitForFeedbackHydration();
      if (first.draftVersion) {
        assert.equal(
          first.draft,
          draftText,
          "Resume only exact unfinished QA draft"
        );
      }
      await page.waitForFunction(() => {
        const node = document.querySelector(".gc-feedback-form textarea");
        return (
          node &&
          Object.keys(node).some((key) => key.startsWith("__reactProps$"))
        );
      });
      await box.fill(draftText);
      await page
        .locator('.gc-feedback-form select[name^="score:"]')
        .nth(0)
        .selectOption("7");
      await page.getByRole("button", { name: "Rascunho", exact: true }).click();
      await page.waitForURL(draftPattern);
      await page.getByText("Rascunho salvo", { exact: true }).waitFor();
      const saved = await lookup(student);
      assert.equal(saved.draft, draftText);
      assert.equal(saved.status, "SUBMITTED");
      assert.equal(saved.feedback, null);
      assert.equal(saved.draftVersion, (first.draftVersion ?? 0) + 1);
      assert.deepEqual(Object.values(saved.draftScores), [7]);
      await page.goto(`${base}/gestao`);
      await page
        .getByRole("heading", { name: "Visão geral", exact: true })
        .waitFor();
      await page.goto(`${base}${queue}&entrega=${first.id}`);
      await page.reload();
      assert.equal(await box.inputValue(), draftText);
      assert.equal(
        await page
          .locator('.gc-feedback-form select[name^="score:"]')
          .nth(0)
          .inputValue(),
        "7"
      );
      assert.equal(
        await page
          .locator('.gc-feedback-form select[name^="score:"]')
          .nth(1)
          .inputValue(),
        ""
      );
      await smoke("draft-resumed");
      results.push("private-draft-partial-scores-reload-resumed");
      const response = await visit("student_04", `/atividades/${slug}`);
      assert.equal((await response.text()).includes(draftText), false);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(
        (await page.locator("body").innerText()).includes(draftText),
        false
      );
      await page.reload();
      assert.equal((await page.content()).includes(draftText), false);
      results.push("student-html-and-reload-without-draft");
      // Reuse a valid own form, but alter only the serialized POST in memory.
      await visit("teacher_2", "/gestao/alunos/correcoes?estado=PENDING");
      await page.locator(".gc-feedback-form").waitFor();
      await waitForFeedbackHydration();
      const ownId = await page
        .locator('input[name="submissionId"]')
        .inputValue();
      assert.notEqual(ownId, first.id);
      const replacements = {
        submissionId: first.id,
        submittedAt: first.submittedAt.toISOString(),
        submissionUpdatedAt: first.updatedAt.toISOString(),
        feedbackVersion: "0",
        draftVersion: String(saved.draftVersion),
      };
      let altered = 0;
      await page.route(`${base}/gestao/alunos/correcoes*`, async (route) => {
        const request = route.request();
        if (request.method() !== "POST" || !request.headers()["next-action"]) {
          await route.continue();
          return;
        }
        const data = await new Request(request.url(), {
          method: "POST",
          headers: request.headers(),
          body: request.postDataBuffer(),
        }).formData();
        for (const [name, value] of Object.entries(replacements)) {
          for (const key of [...data.keys()]) {
            if (key === name || key.endsWith(`_${name}`)) {
              data.set(key, value);
              altered++;
            }
          }
        }
        assert.equal(altered, 5);
        const encoded = new Response(data);
        await route.continue({
          headers: {
            ...Object.fromEntries(
              Object.entries(request.headers()).filter(
                ([name]) => name !== "content-length"
              )
            ),
            "content-type": encoded.headers.get("content-type"),
          },
          postData: Buffer.from(await encoded.arrayBuffer()),
        });
      });
      await page
        .getByRole("textbox", { name: "Comentário ao aluno" })
        .fill("QA local — A2 acesso negado");
      const denied = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          Boolean(r.request().headers()["next-action"])
      );
      await page.getByRole("button", { name: "Rascunho", exact: true }).click();
      assert.equal((await denied).status(), 403);
      assert.equal(altered, 5);
      assert.deepEqual(await lookup(student), saved);
      results.push("foreign-draft-action-403-unchanged");
      await visit("teacher_1", `${queue}&entrega=${first.id}`);
      const resumedBox = page.getByRole("textbox", {
        name: "Comentário ao aluno",
      });
      await resumedBox.waitFor();
      await waitForFeedbackHydration();
      await resumedBox.fill(comment);
      // Comment is required, and incomplete scores cannot send.
      await page
        .getByRole("button", { name: "Enviar feedback", exact: true })
        .click();
      await page
        .getByText("Revise as notas da rubrica antes de enviar.", {
          exact: true,
        })
        .waitFor();
      assert.equal((await lookup(student)).status, "SUBMITTED");
      assert.equal(
        await resumedBox.inputValue(),
        comment,
        "Validation must preserve the new comment"
      );
      await page
        .locator('.gc-feedback-form select[name^="score:"]')
        .nth(1)
        .selectOption("9");
      await page
        .getByRole("button", { name: "Enviar feedback", exact: true })
        .click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("entrega") === second.id &&
          url.searchParams.get("resultado") === "feedback-enviado"
      );
      await page
        .locator(`input[name="submissionId"][value="${second.id}"]`)
        .waitFor({ state: "attached" });
      assert.equal(await resumedBox.inputValue(), "");
      const nextScores = await page
        .locator('.gc-feedback-form select[name^="score:"]')
        .evaluateAll((nodes) => nodes.map((n) => n.value));
      assert.deepEqual(nextScores, ["", ""]);
      assert.equal(new URL(page.url()).searchParams.get("turma"), cohort.id);
      assert.equal(new URL(page.url()).searchParams.get("q"), "A2");
      await smoke("next-pending-clean");
      const sent = await lookup(student);
      assert.equal(sent.status, "REVIEWED");
      assert.equal(sent.feedback, comment);
      assert.equal(sent.draft, null);
      assert.equal(sent.version, 1);
      results.push("sent-draft-consumed-next-filtered-pending-clean-form");
    } else {
      assert.equal(
        first.feedback,
        comment,
        "Resume must not rewrite existing feedback"
      );
      await visit("teacher_1", `${queue}&estado=REVIEWED&entrega=${first.id}`);
      await waitForFeedbackHydration();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Comentário ao aluno" })
          .inputValue(),
        comment
      );
      await smoke("reviewed-feedback-preserved");
      results.push("resume-preserves-sent-feedback");
    }
    if (second.status !== "REVIEWED") {
      await visit("teacher_1", `${queue}&entrega=${second.id}`);
      const box = page.getByRole("textbox", { name: "Comentário ao aluno" });
      await box.waitFor();
      await waitForFeedbackHydration();
      await page
        .getByRole("button", { name: "Enviar feedback", exact: true })
        .click();
      await page
        .getByText("Revise o comentário antes de enviar.", { exact: true })
        .waitFor();
      await box.fill(`${comment} segunda entrega`);
      for (const score of await page
        .locator('.gc-feedback-form select[name^="score:"]')
        .all()) {
        await score.selectOption("8");
      }
      await page
        .getByRole("button", { name: "Enviar feedback", exact: true })
        .click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("resultado") === "feedback-enviado" &&
          !url.searchParams.has("entrega")
      );
      await page
        .getByText("Nenhuma entrega corresponde a estes filtros.", {
          exact: true,
        })
        .waitFor();
      await smoke("queue-finished");
      results.push("last-feedback-empty-filtered-queue");
    }
    await visit("student_04", `/atividades/${slug}`);
    await page.getByText(comment, { exact: true }).waitFor();
    await page.reload();
    await page.getByText(comment, { exact: true }).waitFor();
    await page.getByText("7 / 10", { exact: true }).waitFor();
    await page.getByText("9 / 10", { exact: true }).waitFor();
    assert.equal((await page.content()).includes(draftText), false);
    const completed = await lookup(student);
    assert.deepEqual(Object.values(completed.criteriaScores).sort(), [7, 9]);
    assert.equal(completed.version, 1);
    const secondCompleted = await lookup("gestao_qa_functional_student_02");
    assert.equal(secondCompleted.feedback, `${comment} segunda entrega`);
    assert.deepEqual(
      Object.values(secondCompleted.criteriaScores).sort(),
      [8, 8]
    );
    assert.equal(secondCompleted.version, 1);
    const notifications = (
      await client.query(
        `SELECT "memberId",type,"entityId","dedupeKey" FROM "Notification" WHERE "entityId"=ANY($1::text[]) AND type='FEEDBACK_RECEIVED' ORDER BY "memberId"`,
        [[first.id, second.id]]
      )
    ).rows;
    assert.equal(notifications.length, 2);
    const jobs = (
      await client.query(
        `SELECT e."aggregateId",j.status,j."attemptCount" FROM "DomainEvent" e JOIN "OutboxJob" j ON j."eventId"=e.id WHERE e."aggregateId"=ANY($1::text[]) AND j."consumerKey"='notifications.create.v1' ORDER BY e."aggregateId"`,
        [[first.id, second.id]]
      )
    ).rows;
    assert.equal(jobs.length, 2);
    assert(jobs.every((job) => job.status === "SUCCEEDED"));
    const notificationResponse = await page.request.get(
      `${base}/api/notifications?filter=ACTIVITIES&limit=50`
    );
    assert.equal(notificationResponse.status(), 200);
    assert.equal(
      notificationResponse.headers()["cache-control"],
      "private, no-store"
    );
    const notificationFeed = await notificationResponse.json();
    assert(
      notificationFeed.items.some(
        (item) =>
          item.entityId === first.id && item.type === "FEEDBACK_RECEIVED"
      )
    );
    assert.equal(
      notificationFeed.items.some((item) => item.entityId === second.id),
      false
    );
    results.push("notification-internal-persisted-api-private-job-succeeded");
    await writeFile(
      `${output}/outbox-audit.json`,
      JSON.stringify(jobs, null, 2)
    );
    await writeFile(
      `${output}/notifications-audit.json`,
      JSON.stringify(notifications, null, 2)
    );
    await smoke("student-sent-feedback");
    assert.deepEqual(await preserved(), originalFeedback);
    assert.deepEqual(await otherFeedback(), historyBefore);
    await writeFile(
      `${output}/history-audit.json`,
      JSON.stringify(
        { historyBefore, historyAfter: await otherFeedback() },
        null,
        2
      )
    );
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    const preview = await fetch("http://localhost:3000/gestao");
    assert.equal(preview.status, 200);
    assert((await preview.text()).includes("Esta semana"));
    results.push("original-preview3000-and-history-preserved");
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await page
      ?.screenshot({
        path: `${output}/last-state.png`,
        caret: "initial",
        timeout: 5000,
      })
      .catch(() => {
        /* A failed page must not prevent runtime cleanup. */
      });
    await browser?.close();
    await stop();
    await client.end();
    await writeFile(
      `${output}/results.json`,
      JSON.stringify({ results, pageErrors, consoleErrors }, null, 2)
    );
    console.log(JSON.stringify({ results, pageErrors, consoleErrors }));
  }
});

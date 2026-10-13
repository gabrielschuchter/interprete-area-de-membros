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
const feedbackPattern = /resultado=feedback-enviado/;

await test("MVP local: publish, submit, correct, reload and deny foreign access", async () => {
  assert.equal(process.platform, "win32");
  assert.equal(process.env.QA_MVP_ACTIVITY_WRITE, "true");
  const base = "http://localhost:3000";
  const output = resolve("output/playwright/gestao-v2/mvp-activity");
  const slug = "gestao-qa-mvp-atividade-20261013";
  const title = "QA local — jornada MVP de atividade 20261013";
  const comment = "QA local — revisão MVP com rubrica 20261013";
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
  const activity = async () =>
    (
      await client.query(
        'SELECT id,status,"rubricVersion",version FROM "Activity" WHERE slug=$1',
        [slug]
      )
    ).rows[0];
  const submission = async () =>
    (
      await client.query(
        `SELECT s.id,s.status,s."submittedAt",s."updatedAt",s."rubricVersion",md5(s.content) AS hash,f.content AS feedback,f.version,f."criteriaScores",f."teacherId" FROM "ActivitySubmission" s JOIN "Activity" a ON a.id=s."activityId" LEFT JOIN "Feedback" f ON f."submissionId"=s.id WHERE a.slug=$1 AND s."memberId"=$2`,
        [slug, student]
      )
    ).rows[0];
  const results = [];
  const pageErrors = [];
  let owned;
  let browser;
  let page;
  const start = async (actor, profile = "functional") => {
    assert(
      ["teacher_1", "teacher_2", "student_04", "student_12", "admin"].includes(
        actor
      )
    );
    assert(["functional", "visual"].includes(profile));
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
      resolve(process.env.USERPROFILE, ".bun/bin/bun.exe"),
      ["run", "--cwd", "apps/app", "dev", "--hostname", "127.0.0.1"],
      {
        cwd: process.cwd(),
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
      }
    );
    closeSync(fd);
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
    page.setDefaultTimeout(20_000);
    return page.goto(`${base}${path}`);
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
    await visit("student_04", `/atividades/${slug}`);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    let currentSubmission = await submission();
    if (!currentSubmission) {
      await page
        .getByRole("textbox", { name: "O que você pensa?" })
        .fill(answer);
      await page
        .getByRole("button", { name: "Enviar resposta", exact: true })
        .click();
      await page
        .getByText("Resposta enviada e salva.", { exact: true })
        .waitFor();
      await page.reload();
      assert.equal(
        await page
          .getByRole("textbox", { name: "O que você pensa?" })
          .inputValue(),
        answer
      );
      currentSubmission = await submission();
      assert.equal(currentSubmission.status, "SUBMITTED");
      assert.equal(currentSubmission.rubricVersion, 1);
      results.push("student-submitted-reload");
    }
    await smoke("student-submission");
    const deniedPage = await visit("student_12", `/atividades/${slug}`);
    await page.getByRole("heading").first().waitFor();
    assert.equal(
      await page.getByRole("heading", { name: title, exact: true }).count(),
      0,
      "Outside cohort must not see targeted activity"
    );
    const deniedHtml = await deniedPage.text();
    assert.equal(
      deniedHtml.includes(title),
      false,
      "Denied response cannot contain activity payload"
    );
    await smoke("outsider-denied");
    results.push("outsider-direct-url-denied");
    if (currentSubmission.status !== "REVIEWED") {
      await visit(
        "teacher_1",
        `/gestao/alunos/correcoes?atividade=${currentActivity.id}&entrega=${currentSubmission.id}`
      );
      await page
        .getByRole("textbox", { name: "Comentário ao aluno" })
        .fill(comment);
      const scores = page.locator('.gc-feedback-form select[name^="score:"]');
      assert.equal(await scores.count(), 2);
      await scores.nth(0).selectOption("8");
      await scores.nth(1).selectOption("9");
      await smoke("correction");
      await page
        .getByRole("button", { name: "Enviar feedback", exact: true })
        .click();
      await page.waitForURL(feedbackPattern);
      currentSubmission = await submission();
      assert.equal(currentSubmission.status, "REVIEWED");
      assert.equal(currentSubmission.feedback, comment);
      assert.equal(currentSubmission.teacherId, teacher);
      assert.deepEqual(
        Object.values(currentSubmission.criteriaScores).sort(),
        [8, 9]
      );
      results.push("teacher-corrected-with-rubric");
    } else {
      assert.equal(
        currentSubmission.feedback,
        comment,
        "Resume only exact completed QA feedback"
      );
    }
    await visit("student_04", `/atividades/${slug}`);
    await page.getByText(comment, { exact: true }).waitFor();
    await page.reload();
    await page.getByText(comment, { exact: true }).waitFor();
    await page.getByText("8 / 10", { exact: true }).waitFor();
    await page.getByText("9 / 10", { exact: true }).waitFor();
    await smoke("student-feedback");
    results.push("student-feedback-scores-reload");
    await visit(
      "teacher_2",
      `/gestao/alunos/correcoes?entrega=${currentSubmission.id}`
    );
    assert.equal(
      await page
        .locator(
          `.gc-feedback-form input[name="submissionId"][value="${currentSubmission.id}"]`
        )
        .count(),
      0,
      "Foreign teacher cannot open correction"
    );
    results.push("foreign-teacher-selection-denied");
    await page.goto(`${base}/gestao/alunos/correcoes?estado=PENDING`);
    const form = page.getByRole("main").locator(".gc-feedback-form");
    await form.waitFor();
    const beforeDenial = await submission();
    // Alter the serialized request, not DOM values that React can reconcile.
    // Multipart data stays in memory; never save action headers/body to disk.
    const replacements = {
      submissionId: currentSubmission.id,
      submittedAt: beforeDenial.submittedAt.toISOString(),
      submissionUpdatedAt: beforeDenial.updatedAt.toISOString(),
      feedbackVersion: String(beforeDenial.version),
      draftVersion: "0",
    };
    let alteredFields = 0;
    await page.route(`${base}/gestao/alunos/correcoes*`, async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) {
        await route.continue();
        return;
      }
      const incoming = new Request(request.url(), {
        method: "POST",
        headers: request.headers(),
        body: request.postDataBuffer(),
      });
      const data = await incoming.formData();
      for (const [name, replacement] of Object.entries(replacements)) {
        for (const key of [...data.keys()]) {
          if (key === name || key.endsWith(`_${name}`)) {
            data.set(key, replacement);
            alteredFields += 1;
          }
        }
      }
      if (alteredFields !== 5) {
        await route.abort();
        throw new Error(
          "QA refused to submit an unmodified correction request"
        );
      }
      const encoded = new Response(data);
      const headers = {
        ...Object.fromEntries(
          Object.entries(request.headers()).filter(
            ([name]) => name !== "content-length"
          )
        ),
        "content-type": encoded.headers.get("content-type"),
      };
      await route.continue({
        headers,
        postData: Buffer.from(await encoded.arrayBuffer()),
      });
    });
    await page
      .getByRole("textbox", { name: "Comentário ao aluno" })
      .fill("QA local — tentativa negada do MVP");
    const deniedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        Boolean(response.request().headers()["next-action"])
    );
    await page
      .getByRole("button", { name: "Enviar feedback", exact: true })
      .click();
    assert.equal((await deniedResponse).status(), 403);
    assert.equal(alteredFields, 5);
    assert.deepEqual(await submission(), beforeDenial);
    results.push("foreign-teacher-action-403-unchanged");
    assert.deepEqual(await preserved(), originalFeedback);
    results.push("previous-feedback-preserved");
    assert.deepEqual(pageErrors, []);
  } finally {
    await page?.screenshot({ path: `${output}/last-state.png` });
    await browser?.close();
    await stop();
    await client.end();
    await start("admin", "visual");
    const restoredPreviewPid = owned.pid;
    owned.unref();
    await writeFile(
      `${output}/results.json`,
      JSON.stringify({ results, pageErrors, restoredPreviewPid }, null, 2)
    );
    console.log(JSON.stringify({ results, restoredPreviewPid }));
  }
});

// Explicit loopback QA; creates one cohort and preserves ended memberships.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createGestaoLocalRuntime } from "./gestao-local-runtime.mjs";

const cohortPathPattern = /\/gestao\/alunos\/turmas\/(?!nova$)[^/?]+$/;
await test("T2 local: membership access, removal, independent grant and preserved history", async () => {
  assert.equal(process.platform, "win32");
  assert.equal(process.env.QA_MVP_T2_WRITE, "true");
  const base = "http://127.0.0.1:3002";
  const output = resolve("output/playwright/gestao-v2/mvp-t2");
  await mkdir(output, { recursive: true });
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
  const tls = (
    await client.query(
      "SELECT current_database() AS db,ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    )
  ).rows[0];
  assert.equal(tls.db, "interprete_gestao_qa_20261012");
  assert.equal(tls.ssl, true);
  const course = (
    await client.query(
      `SELECT id,title,slug FROM "Course" WHERE slug='gestao-qa-functional-curso-1' AND status='PUBLISHED'`
    )
  ).rows[0];
  assert(course);
  const name = "QA local — MVP T2 matrícula 20261013";
  const ids = ["04", "11", "12"].map(
    (suffix) => `gestao_qa_functional_student_${suffix}`
  );
  const cohort = async () =>
    (
      await client.query(
        'SELECT id,version FROM "Cohort" WHERE name=$1 AND "createdByMemberId"=$2',
        [name, "gestao_qa_functional_teacher_1"]
      )
    ).rows[0];
  const memberships = async (id) =>
    (
      await client.query(
        'SELECT id,"memberId",status,"leftAt","activeKey" FROM "CohortMembership" WHERE "cohortId"=$1 ORDER BY "memberId",id',
        [id]
      )
    ).rows;
  const grants = async () =>
    (
      await client.query(
        'SELECT id,"subjectMemberId",origin,"resourceId","revokedAt","validUntil" FROM "AccessGrantSource" WHERE "subjectMemberId"=$1 AND "resourceId"=$2 ORDER BY id',
        [ids[2], course.id]
      )
    ).rows;
  const history = async () =>
    (
      await client.query(
        `SELECT s.id,s.status,md5(s.content) AS hash,s."submittedAt",f.version,md5(f.content) AS feedback,f."criteriaScores",f."teacherId" FROM "ActivitySubmission" s LEFT JOIN "Feedback" f ON f."submissionId"=s.id WHERE s."memberId"=$1 ORDER BY s.id`,
        [ids[0]]
      )
    ).rows;
  const initialHistory = await history();
  assert(initialHistory.length >= 2);
  const results = [],
    errors = [];
  const runtime = createGestaoLocalRuntime({
    origin: base,
    distDir: process.env.GESTAO_QA_DIST_DIR ?? ".next-local-a2",
    caPath: ca,
    outputDirectory: output,
  });
  const start = (actor, profile = "functional") =>
    runtime.start(actor, profile, `${output}/${profile}-${actor}.log`);
  const stop = () => runtime.stop();
  let browser, page;
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
    page.setDefaultTimeout(20_000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().startsWith("Failed to load resource:")
      ) {
        errors.push(message.text().slice(0, 300));
      }
    });
    return page.goto(`${base}${path}`);
  };
  const smoke = async (label) => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        ),
        `Overflow: ${label}/${width}`
      );
      await page.screenshot({
        path: `${output}/${label}-${width}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  };
  const courseVisible = async (actor, expected, label) => {
    const response = await visit(actor, `/aprender/cursos/${course.slug}`);
    const html = await response.text();
    if (!expected) {
      await page.getByRole("heading", { name: "404", exact: true }).waitFor();
    }
    if (expected) {
      await page
        .getByRole("heading", { name: course.title, exact: true })
        .waitFor();
    }
    await page.getByRole("heading").first().waitFor();
    assert.equal(
      (await page
        .getByRole("heading", { name: course.title, exact: true })
        .count()) > 0,
      expected
    );
    if (!expected) {
      assert.equal(html.includes(course.title), false);
    }
    const reloaded = await page.reload();
    await reloaded.text();
    if (!expected) {
      await page.getByRole("heading", { name: "404", exact: true }).waitFor();
    }
    if (expected) {
      await page
        .getByRole("heading", { name: course.title, exact: true })
        .waitFor();
    }
    await page.getByRole("heading").first().waitFor();
    assert.equal(
      (await page
        .getByRole("heading", { name: course.title, exact: true })
        .count()) > 0,
      expected
    );
    await smoke(label);
    results.push(label);
  };
  try {
    const { chromium } = await import(
      pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href
    );
    browser = await chromium.launch({
      executablePath: process.env.QA_CHROMIUM_EXECUTABLE,
    });
    let current = await cohort();
    if (!current) {
      await courseVisible("student_11", false, "before-membership-denied");
      await visit("teacher_1", "/gestao/alunos/turmas/nova");
      await page.getByLabel("Nome da turma", { exact: true }).fill(name);
      await page.getByLabel("Começa em", { exact: true }).fill("2026-10-12");
      await page
        .getByRole("button", { name: "Criar turma", exact: true })
        .click();
      await page.waitForURL(cohortPathPattern);
      current = await cohort();
      assert(current);
      results.push("cohort-created-ui");
    }
    const access = (
      await client.query(
        'SELECT id FROM "CohortCourseAccess" WHERE "cohortId"=$1 AND "courseId"=$2 AND "revokedAt" IS NULL',
        [current.id, course.id]
      )
    ).rows;
    if (!access.length) {
      await visit("teacher_1", `/gestao/alunos/turmas/${current.id}/conteudo`);
      await page
        .getByRole("checkbox", {
          name: `${course.title} Curso publicado`,
          exact: true,
        })
        .check();
      await page
        .locator(".gt-course-editor")
        .getByRole("button", { name: "Salvar cronograma", exact: true })
        .click();
      await page.getByText("Cronograma salvo.", { exact: true }).waitFor();
      results.push("course-linked-ui");
    }
    if (!(await grants()).length) {
      await visit(
        "admin",
        `/gestao/ensino/cursos/${course.id}/turmas?membro_busca=Aluno%20QA%20Funcional%2012`
      );
      await page
        .locator('#gca-grant-form select[name="memberId"]')
        .selectOption(ids[2]);
      await page
        .locator("#gca-grant-form")
        .getByRole("button", { name: "Continuar", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirmar acesso", exact: true })
        .click();
      await page.getByText("Alteração salva.", { exact: true }).waitFor();
      results.push("direct-grant-created-ui");
    }
    const independentGrant = await grants();
    await visit("teacher_1", `/gestao/alunos/turmas/${current.id}/conteudo`);
    await page
      .getByRole("heading", { name: "Cursos para esta turma", exact: true })
      .waitFor();
    await smoke("content-current");
    assert.equal(independentGrant.length, 1);
    assert.equal(independentGrant[0].revokedAt, null);
    let roster = await memberships(current.id);
    if (!roster.length) {
      await visit("teacher_1", `/gestao/alunos/turmas/${current.id}/alunos`);
      for (const suffix of ["04", "11", "12"]) {
        await page
          .locator(".gt-addable-list")
          .getByRole("checkbox", {
            name: `Aluno QA Funcional ${suffix}`,
            exact: false,
          })
          .check();
      }
      await page
        .locator(".gt-addable-list")
        .getByRole("button", { name: "Adicionar 3", exact: true })
        .click();
      await page
        .getByText("3 aluno(s) adicionados.", { exact: true })
        .waitFor();
      await page.reload();
      roster = await memberships(current.id);
      assert.equal(roster.filter((m) => m.status === "ACTIVE").length, 3);
      await smoke("roster-added");
      results.push("membership-persisted-reload");
    }
    if (roster.some((m) => m.status === "ACTIVE")) {
      await courseVisible("student_11", true, "cohort-only-access-reload");
      await courseVisible("student_12", true, "union-access-reload");
      await visit("teacher_1", `/gestao/alunos/turmas/${current.id}/alunos`);
      for (const suffix of ["04", "11", "12"]) {
        await page
          .getByRole("checkbox", {
            name: `Selecionar Aluno QA Funcional ${suffix}`,
            exact: true,
          })
          .check();
      }
      await page
        .getByRole("button", { name: "Remover da turma", exact: true })
        .click();
      await smoke("removal-confirmation");
      await page
        .getByRole("button", { name: "Confirmar remoção", exact: true })
        .click();
      await page.getByText("3 aluno(s) removidos.", { exact: true }).waitFor();
      await page.reload();
      roster = await memberships(current.id);
      results.push("removal-persisted-reload");
    }
    assert.equal(roster.length, 3);
    assert(
      roster.every(
        (m) => m.status === "REMOVED" && m.leftAt && m.activeKey === null
      )
    );
    await visit("teacher_1", `/gestao/alunos/turmas/${current.id}/alunos`);
    await page
      .getByRole("heading", { name: "Alunos da turma", exact: true })
      .waitFor();
    await smoke("roster-removed");
    await courseVisible("student_11", false, "cohort-access-revoked-reload");
    await courseVisible("student_12", true, "direct-access-preserved-reload");
    assert.deepEqual(await grants(), independentGrant);
    assert.deepEqual(await history(), initialHistory);
    results.push("history-and-grant-unchanged");
    const denied = await visit(
      "teacher_2",
      `/gestao/alunos/turmas/${current.id}/alunos`
    );
    assert.equal(denied.status(), 403);
    results.push("foreign-cohort-url-403");
    const own = (
      await client.query(
        'SELECT "cohortId" FROM "CohortTeacher" WHERE "memberId"=$1 LIMIT 1',
        ["gestao_qa_functional_teacher_2"]
      )
    ).rows[0];
    assert(own);
    await visit("teacher_2", `/gestao/alunos/turmas/${own.cohortId}/alunos`);
    await page
      .locator(".gt-addable-list")
      .getByRole("checkbox", { name: "Aluno QA Funcional 11", exact: false })
      .check();
    let altered = false;
    await page.route(
      `${base}/gestao/alunos/turmas/${own.cohortId}/alunos`,
      async (route) => {
        const request = route.request();
        if (request.method() !== "POST" || !request.headers()["next-action"]) {
          await route.continue();
          return;
        }
        const data = JSON.parse(request.postData());
        assert(
          Array.isArray(data) && data[0]?.cohortId === own.cohortId,
          "Refuse unrecognized QA action protocol"
        );
        data[0].cohortId = current.id;
        data[0].memberIds = [ids[1]];
        altered = true;
        await route.continue({ postData: JSON.stringify(data) });
      }
    );
    const response = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        Boolean(r.request().headers()["next-action"])
    );
    await page
      .locator(".gt-addable-list")
      .getByRole("button", { name: "Adicionar 1", exact: true })
      .click();
    assert((await (await response).text()).includes("not-found"));
    assert(altered);
    assert.deepEqual(await memberships(current.id), roster);
    assert.deepEqual(await history(), initialHistory);
    results.push("foreign-valid-action-denied-no-write");
    assert.deepEqual(errors, []);
    await writeFile(
      `${output}/audit.json`,
      JSON.stringify(
        {
          tls,
          cohortId: current.id,
          memberships: roster,
          independentGrant,
          historyBefore: initialHistory,
          historyAfter: await history(),
          otherMemberships: (
            await client.query(
              'SELECT "cohortId",status,"leftAt" FROM "CohortMembership" WHERE "memberId"=$1 AND "cohortId"<>$2 ORDER BY "cohortId",id',
              [ids[0], current.id]
            )
          ).rows,
        },
        null,
        2
      )
    );
  } finally {
    if (page && !page.isClosed()) {
      await page.screenshot({
        path: `${output}/last-state.png`,
        caret: "initial",
      });
    }
    await browser?.close();
    await stop();
    await client.end();
    await writeFile(
      `${output}/results.json`,
      JSON.stringify({ results, errors }, null, 2)
    );
    console.log(JSON.stringify({ results, errors }));
  }
});

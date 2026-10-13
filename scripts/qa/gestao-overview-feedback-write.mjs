import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { test } from "node:test";
import { readOverviewExpected } from "./gestao-overview-feedback-checks.mjs";

const base = "http://localhost:3000";
const submissionId = "cmv5mu61d001sowypj5169jnx";
const teacher = "gestao_qa_functional_teacher_1";
const student = "gestao_qa_functional_student_04";
const countPattern = /^\d+/;
const queuePattern = /\/gestao\/alunos\/correcoes/;
const sentPattern = /resultado=feedback-enviado/;
const countHeadingPattern = /^\d+ entregas? aguardando feedback$/;
const comment = "QA local — feedback da visão geral 20261013";

const read = async (client) =>
  (
    await client.query(
      `SELECT s.id,s.status,s."submittedAt",s."updatedAt",s."rubricVersion",md5(s.content) AS hash,
    a.slug,a.title,f.version,f.content AS feedback,f."teacherId",
    EXISTS(SELECT 1 FROM "ActivityFeedbackDraft" d WHERE d."submissionId"=s.id) AS draft
    FROM "ActivitySubmission" s JOIN "Activity" a ON a.id=s."activityId"
    LEFT JOIN "Feedback" f ON f."submissionId"=s.id WHERE s.id=$1 AND s."memberId"=$2`,
      [submissionId, student]
    )
  ).rows[0];

export const prepareFeedbackWrite = async (client) => {
  const original = await read(client);
  if (process.env.QA_OVERVIEW_FEEDBACK_RESUME === "true") {
    assert(
      original.status === "REVIEWED" &&
        original.version === 1 &&
        original.feedback === comment &&
        original.teacherId === teacher &&
        original.draft === false,
      "Resume requires the exact preserved feedback from the initial write run"
    );
    const expected = await readOverviewExpected(client, teacher);
    return {
      original,
      beforeCount: expected.counts[0].count + 1,
      sent: true,
      denied: false,
      resumed: true,
    };
  }
  assert(
    original &&
      original.status === "SUBMITTED" &&
      !original.version &&
      !original.draft,
    "Explicit fresh fixture required; never overwrite or reset completed QA feedback"
  );
  const memberships = (
    await client.query(
      `SELECT DISTINCT t."memberId" AS teacher FROM "CohortMembership" cm
    JOIN "Cohort" c ON c.id=cm."cohortId" JOIN "CohortTeacher" t ON t."cohortId"=c.id
    WHERE cm."memberId"=$1 AND cm.status='ACTIVE' AND cm."leftAt" IS NULL AND c."archivedAt" IS NULL`,
      [student]
    )
  ).rows;
  assert(memberships.some((row) => row.teacher === teacher));
  assert(
    !memberships.some((row) => row.teacher === "gestao_qa_functional_teacher_2")
  );
  return { original, beforeCount: null, sent: false, denied: false };
};

export const sendOverviewFeedback = async (page, client, state) =>
  test("Main: persist feedback and reconcile count", async () => {
    await page.goto(`${base}/gestao`);
    const heading = page.getByRole("heading", { name: countHeadingPattern });
    state.beforeCount = Number(
      (await heading.innerText()).match(countPattern)[0]
    );
    await page.getByRole("link", { name: "Corrigir", exact: true }).click();
    await page.waitForURL(queuePattern);
    await page.goto(
      `${base}/gestao/alunos/correcoes?estado=PENDING&entrega=${submissionId}`
    );
    await page
      .getByRole("button", { name: "Enviar feedback", exact: true })
      .click();
    await page.locator("#gc-comment-error").waitFor();
    assert(!(await read(client)).version, "Validation must not write feedback");
    await page
      .getByRole("textbox", { name: "Comentário ao aluno" })
      .fill(comment);
    await page
      .getByRole("button", { name: "Enviar feedback", exact: true })
      .click();
    await page.waitForURL(sentPattern);
    await page
      .getByText("Feedback enviado. A entrega foi marcada como corrigida.", {
        exact: true,
      })
      .waitFor();
    const persisted = await read(client);
    assert.equal(persisted.status, "REVIEWED");
    assert.equal(persisted.version, 1);
    assert.equal(persisted.feedback, comment);
    assert.equal(persisted.teacherId, teacher);
    assert.equal(persisted.hash, state.original.hash);
    assert.equal(persisted.draft, false);
    assert.equal(
      persisted.submittedAt.toISOString(),
      state.original.submittedAt.toISOString()
    );
    await page.goto(`${base}/gestao`);
    await page
      .getByRole("heading", {
        name: `${state.beforeCount - 1} entregas aguardando feedback`,
        exact: true,
      })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", {
        name: `${state.beforeCount - 1} entregas aguardando feedback`,
        exact: true,
      })
      .waitFor();
    await page.screenshot({
      path: "output/playwright/gestao-v2/overview-feedback/after-feedback.png",
    });
    state.sent = true;
  });

export const denyForeignFeedback = async (page, client, state) =>
  test("Main: foreign valid action and replay denied", async () => {
    assert(state.sent);
    await page.setViewportSize({ width: 1440, height: 900 });
    const before = await read(client);
    await page.goto(`${base}/gestao/alunos/correcoes?estado=PENDING`);
    const form = page.getByRole("main").locator(".gc-feedback-form");
    await form.waitFor();
    await form.evaluate(
      (form, values) => {
        for (const [name, value] of Object.entries(values)) {
          form.elements.namedItem(name).value = value;
        }
      },
      {
        submissionId,
        submittedAt: before.submittedAt.toISOString(),
        submissionUpdatedAt: before.updatedAt.toISOString(),
        draftVersion: "0",
        feedbackVersion: "1",
      }
    );
    await page
      .getByRole("textbox", { name: "Comentário ao aluno" })
      .fill("QA local — tentativa fora do escopo");
    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" && Boolean(request.headers()["next-action"])
    );
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        Boolean(response.request().headers()["next-action"])
    );
    await page
      .getByRole("button", { name: "Enviar feedback", exact: true })
      .click();
    const request = await requestPromise;
    assert.equal((await responsePromise).status(), 403);
    // Keep the valid action protocol/body in memory only. The replay URL has no cohort guard shortcut.
    const headers = request.headers();
    const replay = await page
      .context()
      .request.post(`${base}/gestao/alunos/correcoes`, {
        headers: {
          "next-action": headers["next-action"],
          "content-type": headers["content-type"],
          origin: base,
        },
        data: request.postDataBuffer(),
      });
    assert.equal(replay.status(), 403);
    const after = await read(client);
    assert.deepEqual(
      after,
      before,
      "Denied UI and direct action must preserve submission and feedback"
    );
    state.denied = true;
  });

export const verifyStudentFeedback = async (page, client, state) =>
  test("Main: student feedback and delivered internal notification", async () => {
    assert(state.sent && state.denied);
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(
      `${base}/atividades/${state.original.slug}`
    );
    assert.equal(response.status(), 200);
    await page.getByText(comment, { exact: true }).waitFor();
    await page.reload();
    await page.getByText(comment, { exact: true }).waitFor();
    await page.screenshot({
      path: "output/playwright/gestao-v2/overview-feedback/student-feedback.png",
    });
    const notifications = (
      await client.query(
        'SELECT id FROM "Notification" WHERE "memberId"=$1 AND type=$2 AND "dedupeKey"=$3',
        [student, "FEEDBACK_RECEIVED", `feedback:${submissionId}:v1`]
      )
    ).rows;
    assert.equal(notifications.length, 1);
    const jobs = (
      await client.query(
        'SELECT j.status FROM "OutboxJob" j JOIN "DomainEvent" e ON e.id=j."eventId" WHERE e."idempotencyKey"=$1',
        [`activity-feedback:${submissionId}:v1:batch:0`]
      )
    ).rows;
    assert(jobs.length > 0 && jobs.every((job) => job.status === "SUCCEEDED"));
    const after = await read(client);
    assert.equal(after.hash, state.original.hash);
    assert.equal(after.version, 1);
    await writeFile(
      "output/playwright/gestao-v2/overview-feedback/write-result.json",
      JSON.stringify(
        {
          persisted: true,
          reload: true,
          studentReload: true,
          answerPreserved: true,
          foreignActionStatus: 403,
          directReplayStatus: 403,
          beforeCount: state.beforeCount,
          afterCount: state.beforeCount - 1,
          notificationCount: notifications.length,
          outboxCompleted: true,
          rubricVersion: after.rubricVersion,
        },
        null,
        2
      )
    );
  });

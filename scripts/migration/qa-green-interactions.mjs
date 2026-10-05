const ORIGIN = process.env.GREEN_QA_APP_ORIGIN ?? "http://localhost:3100";
const check = (report, name, pass) => report.checks.push({ name, pass });
const waitForAction = (page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().startsWith(ORIGIN),
    { timeout: 30_000 }
  );

const validateLearning = async ({ sql, page, userId, report }) => {
  const lesson = (
    await sql.query(
      'SELECT l.id,l.slug,l.title,c.title AS course_title,c.slug AS course_slug FROM public."Lesson" l JOIN public."Module" m ON m.id=l."moduleId" JOIN public."Course" c ON c.id=m."courseId" LEFT JOIN public."LearningPath" p ON p.id=c."learningPathId" WHERE l.status=\'PUBLISHED\' AND m.status=\'PUBLISHED\' AND c.status=\'PUBLISHED\' AND c.experience=\'ASYNC\' AND (p.id IS NULL OR p.status=\'PUBLISHED\') ORDER BY l.id LIMIT 1'
    )
  ).rows[0];
  if (!lesson) {
    throw new Error("Expected migrated published lesson is absent.");
  }
  const courseUrl = `${ORIGIN}/aprender/cursos/${encodeURIComponent(lesson.course_slug)}`;
  const lessonUrl = `${courseUrl}/${encodeURIComponent(lesson.slug)}`;
  await page.goto(lessonUrl);
  const missing = page.getByRole("heading", { name: "404", exact: true });
  const denialVisible = await missing
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  check(
    report,
    "Unentitled member cannot read a lesson by direct URL",
    denialVisible &&
      !(await page
        .getByRole("heading", { name: lesson.title, exact: true })
        .count())
  );
  try {
    await sql.query("UPDATE public.\"Member\" SET role='TEACHER' WHERE id=$1", [
      userId,
    ]);
    const course = await page.goto(courseUrl);
    await page
      .getByRole("heading", { name: lesson.course_title, exact: true })
      .waitFor({ state: "visible", timeout: 20_000 });
    check(
      report,
      "Authorized teacher reads migrated course and modules",
      course.status() === 200
    );
    const response = await page.goto(lessonUrl);
    await page
      .getByRole("heading", { name: lesson.title, exact: true })
      .waitFor({ state: "visible", timeout: 20_000 });
    check(
      report,
      "Authorized teacher reads migrated lesson",
      response.status() === 200
    );
    const complete = page.getByRole("button", {
      name: "Marcar como concluída",
      exact: true,
    });
    if (await complete.count()) {
      const action = waitForAction(page);
      await complete.click();
      await action;
    }
    const progress = (
      await sql.query(
        'SELECT status,"completedAt" FROM public."LessonProgress" WHERE "lessonId"=$1 AND "memberId"=$2',
        [lesson.id, userId]
      )
    ).rows[0];
    check(
      report,
      "Lesson completion persisted through actual form",
      progress?.status === "COMPLETED" && !!progress.completedAt
    );
    await page.reload();
    const completed = page.getByRole("button", {
      name: "Aula concluída",
      exact: true,
    });
    const completionVisible = await completed
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check(
      report,
      "Lesson completion survives reload",
      completionVisible && (await completed.isDisabled())
    );
  } finally {
    await sql.query("UPDATE public.\"Member\" SET role='MEMBER' WHERE id=$1", [
      userId,
    ]);
  }
  await page.goto(lessonUrl);
  const stillDenied = await missing
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  check(
    report,
    "Progress does not grant access after role removal",
    stillDenied &&
      !(await page
        .getByRole("heading", { name: lesson.title, exact: true })
        .count())
  );
};

export const validateGreenInteractions = async ({
  sql,
  page,
  userId,
  report,
}) => {
  await validateLearning({ sql, page, userId, report });
  await page.goto(`${ORIGIN}/comunidade/publicacoes/qa-green-preserved-post`);
  for (const name of ["Apoiar conteúdo", "Salvar publicação"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.count()) {
      const action = waitForAction(page);
      await button.click();
      await action;
      await page.reload();
    }
  }
  const interactions = (
    await sql.query(
      'SELECT (SELECT count(*)::int FROM public."PostVote" WHERE "postId"=$1 AND "memberId"=$2) votes,(SELECT count(*)::int FROM public."CommunityBookmark" WHERE "postId"=$1 AND "memberId"=$2) bookmarks',
      ["qa-green-preserved-post", userId]
    )
  ).rows[0];
  check(
    report,
    "Community vote persisted through real UI",
    interactions.votes === 1
  );
  check(
    report,
    "Community bookmark persisted after reload",
    interactions.bookmarks === 1
  );

  const item = (
    await sql.query(
      "SELECT id FROM public.\"LibraryItem\" WHERE status='PUBLISHED' ORDER BY id LIMIT 1"
    )
  ).rows[0];
  if (!item) {
    throw new Error("Expected migrated published library item is absent.");
  }
  await page.goto(`${ORIGIN}/biblioteca/${encodeURIComponent(item.id)}`);
  const save = page.getByRole("button", { name: "Salvar", exact: true });
  if (await save.count()) {
    const action = waitForAction(page);
    await save.click();
    await action;
  }
  await page.reload();
  const bookmark = (
    await sql.query(
      'SELECT count(*)::int count FROM public."LibraryBookmark" WHERE "itemId"=$1 AND "memberId"=$2',
      [item.id, userId]
    )
  ).rows[0];
  check(
    report,
    "Library bookmark persisted through real UI",
    bookmark.count === 1
  );
  check(
    report,
    "Library bookmark reflected after reload",
    (await page
      .getByRole("button", { name: "Remover dos salvos", exact: true })
      .count()) === 1
  );

  const submission = (
    await sql.query(
      'SELECT id FROM public."ActivitySubmission" WHERE "activityId"=$1 AND "memberId"=$2',
      ["qa-green-preserved-activity", userId]
    )
  ).rows[0];
  if (!submission) {
    throw new Error("Expected explicit QA submission is absent.");
  }
  try {
    await sql.query("UPDATE public.\"Member\" SET role='TEACHER' WHERE id=$1", [
      userId,
    ]);
    await page.goto(`${ORIGIN}/admin/activities`);
    const form = page.locator("form").filter({
      has: page.locator(`input[name="submissionId"][value="${submission.id}"]`),
    });
    await form
      .locator('textarea[name="content"]')
      .fill("Feedback explícito de QA green, preservar.");
    const action = waitForAction(page);
    await form
      .getByRole("button", { name: "Salvar feedback", exact: true })
      .click();
    const response = await action;
    const saved = (
      await sql.query(
        'SELECT s.status,f.content FROM public."ActivitySubmission" s JOIN public."Feedback" f ON f."submissionId"=s.id WHERE s.id=$1 AND f."teacherId"=$2',
        [submission.id, userId]
      )
    ).rows[0];
    check(
      report,
      "Teacher feedback persisted through actual form",
      response.ok() &&
        saved?.status === "REVIEWED" &&
        saved.content === "Feedback explícito de QA green, preservar."
    );
  } finally {
    await sql.query("UPDATE public.\"Member\" SET role='MEMBER' WHERE id=$1", [
      userId,
    ]);
  }
  await page.goto(`${ORIGIN}/atividades/qa-green-preserved-activity`);
  check(
    report,
    "Member can read teacher feedback after reload",
    (await page
      .getByText("Feedback explícito de QA green, preservar.", { exact: true })
      .count()) === 1
  );
};

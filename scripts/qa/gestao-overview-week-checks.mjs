import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { test } from "node:test";

const base = "http://localhost:3000";
const output = "output/playwright/gestao-v2/overview-week";

const weekStart = (now) => {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const result = new Date(`${day}T03:00:00Z`);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
};
const mergedSeconds = (rows, start, end) => {
  const sorted = rows
    .map((row) => [
      Math.max(row.start.getTime(), start.getTime()),
      Math.min(row.end.getTime(), end.getTime()),
    ])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    lastStart = null,
    lastEnd = null;
  for (const [a, b] of sorted) {
    if (lastEnd === null || a > lastEnd) {
      if (lastEnd !== null) {
        total += lastEnd - lastStart;
      }
      lastStart = a;
      lastEnd = b;
    } else {
      lastEnd = Math.max(lastEnd, b);
    }
  }
  if (lastEnd !== null) {
    total += lastEnd - lastStart;
  }
  return total / 1000;
};

const expectedCase = (data, cohortId) => {
  const cohorts = data.cohorts.filter((c) => !cohortId || c.id === cohortId);
  const cohortIds = new Set(cohorts.map((c) => c.id));
  const memberships = data.memberships.filter(
    (cm) => cohortIds.has(cm.cohortId) && cm.status === "ACTIVE" && !cm.leftAt
  );
  const enrolled = new Set(memberships.map((cm) => cm.memberId));
  const members = data.members.filter(
    (m) =>
      m.role === "MEMBER" &&
      !m.deactivated &&
      ((data.admin && !cohortId) || enrolled.has(m.id))
  );
  const ids = new Set(members.map((m) => m.id));
  const active = cohorts.filter(
    (c) => c.start <= data.now && (!c.end || c.end > data.now)
  );
  const activeIds = new Set(active.map((c) => c.id));
  const activeStudents = new Set(
    memberships
      .filter((cm) => activeIds.has(cm.cohortId) && ids.has(cm.memberId))
      .map((cm) => cm.memberId)
  ).size;
  const deliveries = data.submissions.filter(
    (s) =>
      ids.has(s.memberId) &&
      ["SUBMITTED", "REVIEWED"].includes(s.status) &&
      s.time >= data.start &&
      s.time <= data.now
  );
  const lessons = data.lessons.filter(
    (p) => ids.has(p.memberId) && p.time >= data.start && p.time <= data.now
  ).length;
  const previousLessons = data.lessons.filter(
    (p) =>
      ids.has(p.memberId) &&
      p.time >= data.previousStart &&
      p.time <= data.previousEnd
  ).length;
  const studySeconds = Math.floor(
    members.reduce(
      (sum, m) =>
        sum +
        mergedSeconds(
          data.intervals.filter((i) => i.memberId === m.id),
          data.start,
          data.now
        ),
      0
    )
  );
  return {
    activeCohorts: active.length,
    activeStudents,
    students: members.length,
    submissions: deliveries.length,
    reviewed: deliveries.filter((s) => s.status === "REVIEWED").length,
    lessons,
    previousLessons,
    studySeconds,
    averageStudySeconds: members.length
      ? Math.floor(studySeconds / members.length)
      : null,
  };
};

// Independent JS scope/dedup/interval union oracle, reading only the exact QA DB.
export const readWeekExpected = async (client, actorId) => {
  const db = (
    await client.query(
      "SELECT current_database() AS db,ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    )
  ).rows[0];
  assert(
    [
      "interprete_gestao_qa_20261012",
      "interprete_gestao_visual_qa_20261012",
    ].includes(db.db) && db.ssl
  );
  const members = (
    await client.query(
      'SELECT id,role,"deactivatedAt" AS deactivated FROM "Member"'
    )
  ).rows;
  assert(
    members.length <= 1000,
    "QA oracle does not target a real member dataset"
  );
  const actor = members.find((m) => m.id === actorId && !m.deactivated);
  assert(actor && ["ADMIN", "TEACHER"].includes(actor.role));
  const teachers = (
    await client.query('SELECT "memberId","cohortId" FROM "CohortTeacher"')
  ).rows;
  const cohorts = (
    await client.query(
      'SELECT id,name,"startsAt" AT TIME ZONE \'UTC\' AS start,"endsAt" AT TIME ZONE \'UTC\' AS end FROM "Cohort" WHERE "archivedAt" IS NULL'
    )
  ).rows.filter(
    (c) =>
      actor.role === "ADMIN" ||
      teachers.some((t) => t.memberId === actorId && t.cohortId === c.id)
  );
  const memberships = (
    await client.query(
      'SELECT "memberId","cohortId",status,"leftAt" FROM "CohortMembership"'
    )
  ).rows;
  const submissions = (
    await client.query(
      'SELECT "memberId",status,"submittedAt" AT TIME ZONE \'UTC\' AS time FROM "ActivitySubmission" WHERE "submittedAt" IS NOT NULL'
    )
  ).rows;
  const lessons = (
    await client.query(
      'SELECT "memberId","completedAt" AT TIME ZONE \'UTC\' AS time FROM "LessonProgress" WHERE status=\'COMPLETED\' AND "completedAt" IS NOT NULL'
    )
  ).rows;
  const intervals = (
    await client.query(
      'SELECT "memberId","startedAt" AT TIME ZONE \'UTC\' AS start,"endedAt" AT TIME ZONE \'UTC\' AS end FROM "StudyActivityInterval"'
    )
  ).rows;
  const now = new Date(),
    start = weekStart(now),
    previousStart = new Date(start.getTime() - 604_800_000),
    previousEnd = new Date(now.getTime() - 604_800_000);
  const data = {
    now,
    start,
    previousStart,
    previousEnd,
    admin: actor.role === "ADMIN",
    members,
    cohorts,
    memberships,
    submissions,
    lessons,
    intervals,
  };
  return {
    actorId,
    cohorts,
    cases: [null, ...cohorts.map((c) => c.id)].map((cohortId) => ({
      cohortId,
      expected: expectedCase(data, cohortId),
    })),
  };
};

const formatExpectedTime = (seconds) => {
  if (seconds === null) {
    return "—";
  }
  if (seconds > 0 && seconds < 60) {
    return "Menos de 1 min";
  }
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};
const assertMetrics = async (page, expected) =>
  test("weekly totals match independent scope and interval union", async () => {
    const panel = page.getByRole("region", {
      name: "Esta semana",
      exact: true,
    });
    await panel.waitFor();
    for (const [metric, key] of [
      ["active-cohorts", "activeCohorts"],
      ["submissions", "submissions"],
      ["lessons", "lessons"],
    ]) {
      assert.equal(
        await panel
          .locator(`[data-week-metric="${metric}"] .go-week-value`)
          .innerText(),
        String(expected[key])
      );
    }
    assert(
      (
        await panel.locator('[data-week-metric="submissions"] p').innerText()
      ).startsWith(`${expected.reviewed} `)
    );
    const time = formatExpectedTime(expected.averageStudySeconds);
    const duration = panel.locator('[data-week-metric="study-time"] time');
    if (expected.averageStudySeconds === null) {
      assert.equal(await duration.count(), 0);
    } else {
      assert.equal(
        await duration.getAttribute("datetime"),
        `PT${expected.averageStudySeconds}S`
      );
    }
    assert.equal(
      await panel.locator('[data-week-metric="active-cohorts"] p').innerText(),
      `${expected.activeStudents} ${expected.activeStudents === 1 ? "aluno único" : "alunos únicos"} nas turmas ativas`
    );
    assert.equal(
      await panel
        .locator('[data-week-metric="study-time"] .go-week-value')
        .innerText(),
      time
    );
    assert.equal(
      await panel.locator('[data-week-metric="study-time"] p').innerText(),
      expected.students
        ? `por aluno · ${expected.students} no filtro`
        : "Nenhum aluno no filtro"
    );
    const comparison = expected.previousLessons
      ? `${Math.round((expected.lessons / expected.previousLessons - 1) * 100) > 0 ? "+" : ""}${Math.round((expected.lessons / expected.previousLessons - 1) * 100)}% no mesmo período da semana anterior`
      : "Sem base na semana anterior";
    assert.equal(
      await panel.locator('[data-week-metric="lessons"] p').innerText(),
      comparison
    );
  });

export const verifyWeek = async (page, oracle) =>
  test(`Main week ${oracle.actorId}`, async () => {
    const errors = [];
    const recordError = (e) => errors.push(e.message);
    page.on("pageerror", recordError);
    await mkdir(output, { recursive: true });
    for (const entry of oracle.cases) {
      await page.goto(
        `${base}/gestao${entry.cohortId ? `?turma=${entry.cohortId}` : ""}`
      );
      await assertMetrics(page, entry.expected);
      await page.reload();
      await assertMetrics(page, entry.expected);
    }
    await page.goto(`${base}/gestao`);
    for (const width of [1440, 1280, 1024, 820, 390, 320]) {
      for (const motionMode of ["standard"]) {
        await page.setViewportSize({ width, height: 900 });
        await assertMetrics(page, oracle.cases[0].expected);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        );
        await page.screenshot({
          path: `${output}/${oracle.actorId}-${width}-${motionMode}.png`,
        });
      }
    }
    page.off("pageerror", recordError);
    assert.deepEqual(errors, []);
    await writeFile(
      `${output}/${oracle.actorId}.json`,
      JSON.stringify({ cases: oracle.cases, reload: true, errors }, null, 2)
    );
  });

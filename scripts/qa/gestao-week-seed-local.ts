// Explicit additive QA cases. Existing records are never updated or removed.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid.local");
if (
  process.env.NODE_ENV !== "development" ||
  process.env.SEED_DEVELOPMENT_DATA !== "true" ||
  process.env.QA_WEEK_SEED !== "true" ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55433" ||
  url.pathname !== "/interprete_gestao_qa_20261012" ||
  !process.env.DATABASE_CA_CERT_PATH
) {
  throw new Error(
    "Explicit functional loopback development seed with verified CA required"
  );
}
const { database } = await import("../../packages/database");
const prefix = "gestao_week_qa_20261013";
const student = (suffix: string) => `gestao_qa_functional_student_${suffix}`;
const cases = [
  ["boundary", student("04"), "2026-10-12T02:59:00Z", "2026-10-12T03:01:00Z"],
  ["overlap", student("04"), "2026-10-12T03:00:30Z", "2026-10-12T03:02:00Z"],
  ["duplicate", student("04"), "2026-10-12T03:00:30Z", "2026-10-12T03:02:00Z"],
  [
    "multi-cohort",
    student("03"),
    "2026-10-12T04:00:00Z",
    "2026-10-12T04:02:00Z",
  ],
  [
    "staff",
    "gestao_qa_functional_teacher_1",
    "2026-10-12T04:00:00Z",
    "2026-10-12T04:10:00Z",
  ],
  [
    "previous-week",
    student("04"),
    "2026-10-05T04:00:00Z",
    "2026-10-05T04:10:00Z",
  ],
] as const;
const completions = [
  [student("04"), 1, "2026-10-12T06:00:00Z"],
  [student("03"), 2, "2026-10-12T07:00:00Z"],
  [student("04"), 3, "2026-10-05T06:00:00Z"],
  [student("03"), 4, "2026-10-09T06:00:00Z"],
  ["gestao_qa_functional_teacher_1", 5, "2026-10-12T06:00:00Z"],
] as const;
try {
  const settings = await database.$queryRaw<
    { db: string; ssl: boolean }[]
  >`SELECT current_database() AS db,ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()`;
  if (
    settings[0]?.db !== "interprete_gestao_qa_20261012" ||
    !settings[0]?.ssl
  ) {
    throw new Error("QA TLS required");
  }
  await database.$transaction(async (tx) => {
    for (const [key, memberId, startValue, endValue] of cases) {
      const startedAt = new Date(startValue),
        endedAt = new Date(endValue);
      const id = `${prefix}_${key}`;
      const intervalCount = Math.ceil(
        (endedAt.getTime() - startedAt.getTime()) / 30_000
      );
      if (
        !(await tx.member.findUnique({
          where: { id: memberId },
          select: { id: true },
        }))
      ) {
        throw new Error("Persisted fixture required");
      }
      await tx.studyTrackingSession.createMany({
        skipDuplicates: true,
        data: [
          {
            id,
            memberId,
            clientSessionId: id,
            activityKind: "ACTIVITY",
            lastHeartbeatAt: endedAt,
            startedAt,
            endedAt,
            lastSequence: intervalCount - 1,
          },
        ],
      });
      await tx.studyActivityInterval.createMany({
        skipDuplicates: true,
        data: Array.from({ length: intervalCount }, (_, sequence) => {
          const sliceStart = new Date(startedAt.getTime() + sequence * 30_000);
          const sliceEnd = new Date(
            Math.min(endedAt.getTime(), sliceStart.getTime() + 30_000)
          );
          return {
            id: `${id}_${sequence}`,
            memberId,
            sessionId: id,
            sequence,
            startedAt: sliceStart,
            endedAt: sliceEnd,
            seconds: (sliceEnd.getTime() - sliceStart.getTime()) / 1000,
          };
        }),
      });
    }
    for (const [memberId, index, completed] of completions) {
      const lessons = await tx.lesson.findMany({
        where: {
          slug: `gestao-qa-functional-aula-${index}`,
          status: "PUBLISHED",
          module: {
            is: {
              course: { is: { slug: { startsWith: "gestao-qa-functional-" } } },
            },
          },
        },
        take: 2,
        select: { id: true },
      });
      if (lessons.length !== 1) {
        throw new Error("Published QA lesson fixture required");
      }
      const lesson = lessons[0];
      const id = `${prefix}_lesson_${index}`;
      const existing = await tx.lessonProgress.findUnique({
        where: { memberId_lessonId: { memberId, lessonId: lesson.id } },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        throw new Error(
          "Existing progress preserved; choose another explicit fixture"
        );
      }
      await tx.lessonProgress.createMany({
        skipDuplicates: true,
        data: [
          {
            id,
            memberId,
            lessonId: lesson.id,
            status: "COMPLETED",
            startedAt: new Date(completed),
            completedAt: new Date(completed),
          },
        ],
      });
    }
  });
  console.log(
    JSON.stringify({
      seed: "gestao-week-20261013",
      intervalCases: cases.length,
      lessonCases: completions.length,
      additive: true,
    })
  );
} finally {
  await database.$disconnect();
}
export {};

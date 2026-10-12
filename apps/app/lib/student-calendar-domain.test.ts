import { describe, expect, it } from "vitest";
import {
  resolveStudentCalendarLessonReleases,
  type StudentCalendarReleaseCandidate,
  type StudentCalendarReleaseMembership,
} from "./student-calendar-domain";

const at = new Date("2026-10-12T12:00:00.000Z");
const range = {
  start: new Date("2026-10-01T00:00:00.000Z"),
  end: new Date("2026-11-01T00:00:00.000Z"),
};
const releaseAt = new Date("2026-10-20T12:00:00.000Z");

const candidate = (
  overrides: Partial<StudentCalendarReleaseCandidate> = {}
): StudentCalendarReleaseCandidate => ({
  id: "release-a",
  cohortId: "cohort-a",
  lessonId: "lesson-a",
  releaseAt,
  lesson: {
    title: "Aula de avaliação",
    slug: "aula-de-avaliacao",
    module: {
      courseId: "course-a",
      course: { id: "course-a", slug: "curso-clinico" },
    },
  },
  ...overrides,
});

const courseAccess = (
  overrides: Partial<
    StudentCalendarReleaseMembership["cohort"]["courseAccesses"][number]
  > = {}
) => ({
  courseId: "course-a",
  createdAt: new Date("2026-09-12T00:00:00.000Z"),
  releaseMode: "SCHEDULE" as const,
  startsAt: new Date("2026-10-19T00:00:00.000Z"),
  revokedAt: null,
  ...overrides,
});

const membership = (
  overrides: Partial<StudentCalendarReleaseMembership> = {}
): StudentCalendarReleaseMembership => ({
  cohortId: "cohort-a",
  joinedAt: new Date("2026-09-10T12:00:00.000Z"),
  cohort: {
    archivedAt: null,
    endsAt: null,
    startsAt: new Date("2026-09-01T00:00:00.000Z"),
    lateJoinPolicy: "FROM_JOIN",
    readAfterEndDays: 90,
    courseAccesses: [courseAccess()],
  },
  ...overrides,
});

describe("student calendar lesson releases", () => {
  it("shows a published scheduled lesson only when cohort access is effective at release", () => {
    expect(
      resolveStudentCalendarLessonReleases(
        [candidate()],
        [membership()],
        range,
        at
      )
    ).toEqual([
      {
        id: "release-a",
        lessonId: "lesson-a",
        title: "Aula de avaliação",
        lessonSlug: "aula-de-avaliacao",
        courseId: "course-a",
        courseSlug: "curso-clinico",
        releaseAt,
        href: "/aprender/cursos/curso-clinico/aula-de-avaliacao",
      },
    ]);
  });

  it("honors join time, cohort read window, course schedule, and revocation", () => {
    expect(
      resolveStudentCalendarLessonReleases(
        [candidate()],
        [membership({ joinedAt: new Date("2026-10-21T00:00:00.000Z") })],
        range,
        at
      )
    ).toEqual([]);

    expect(
      resolveStudentCalendarLessonReleases(
        [candidate()],
        [
          membership({
            cohort: {
              ...membership().cohort,
              courseAccesses: [
                courseAccess({
                  revokedAt: new Date("2026-10-15T00:00:00.000Z"),
                }),
              ],
            },
          }),
        ],
        range,
        at
      )
    ).toEqual([]);

    expect(
      resolveStudentCalendarLessonReleases(
        [candidate()],
        [
          membership({
            joinedAt: new Date("2026-10-01T00:00:00.000Z"),
            cohort: {
              ...membership().cohort,
              courseAccesses: [
                courseAccess({
                  createdAt: new Date("2026-09-20T00:00:00.000Z"),
                }),
              ],
            },
          }),
        ],
        range,
        at
      )
    ).toEqual([]);

    expect(
      resolveStudentCalendarLessonReleases(
        [candidate()],
        [
          membership({
            cohort: {
              ...membership().cohort,
              archivedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          }),
        ],
        range,
        at
      )
    ).toEqual([]);

    expect(
      resolveStudentCalendarLessonReleases(
        [candidate()],
        [
          membership({
            cohort: {
              ...membership().cohort,
              courseAccesses: [
                courseAccess({
                  startsAt: new Date("2026-10-21T00:00:00.000Z"),
                }),
              ],
            },
          }),
        ],
        range,
        at
      )
    ).toEqual([]);
  });

  it("deduplicates a lesson released by multiple cohorts at the earliest valid date", () => {
    const laterRelease = new Date("2026-10-25T12:00:00.000Z");
    const secondCandidate = candidate({
      id: "release-b",
      cohortId: "cohort-b",
      releaseAt: laterRelease,
    });
    const secondMembership = membership({
      cohortId: "cohort-b",
      cohort: {
        ...membership().cohort,
        courseAccesses: [courseAccess({ startsAt: releaseAt })],
      },
    });

    expect(
      resolveStudentCalendarLessonReleases(
        [secondCandidate, candidate()],
        [secondMembership, membership()],
        range,
        at
      )
    ).toHaveLength(1);
    expect(
      resolveStudentCalendarLessonReleases(
        [secondCandidate, candidate()],
        [secondMembership, membership()],
        range,
        at
      )[0]?.releaseAt
    ).toEqual(releaseAt);
  });
});

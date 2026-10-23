import { describe, expect, it } from "vitest";
import {
  resolveStudentCalendarCohortEvents,
  resolveStudentCalendarLessonReleases,
  type StudentCalendarCohortEventCandidate,
  type StudentCalendarEventMembership,
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
        href: "/cursos/curso-clinico/aula-de-avaliacao",
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

const calendarEvent = (
  overrides: Partial<StudentCalendarCohortEventCandidate> = {}
): StudentCalendarCohortEventCandidate => ({
  id: "event-a",
  cohortId: "cohort-a",
  title: "Encontro da turma",
  description: "Revisão coletiva",
  startsAt: releaseAt,
  endsAt: new Date("2026-10-20T13:00:00.000Z"),
  allDay: false,
  color: "#6B5B64",
  createdAt: new Date("2026-09-15T12:00:00.000Z"),
  publishedAt: new Date("2026-09-15T12:00:00.000Z"),
  status: "PUBLISHED",
  ...overrides,
});

const eventMembership = (
  overrides: Partial<StudentCalendarEventMembership> = {}
): StudentCalendarEventMembership => ({
  cohortId: "cohort-a",
  joinedAt: new Date("2026-09-10T12:00:00.000Z"),
  includePastReadOnly: false,
  cohort: {
    archivedAt: null,
    endsAt: null,
    lateJoinPolicy: "ALL_ACTIVE",
    readAfterEndDays: 90,
    startsAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  ...overrides,
});

describe("student calendar cohort events", () => {
  it("projects published events overlapping the requested range for current members", () => {
    expect(
      resolveStudentCalendarCohortEvents(
        [
          calendarEvent(),
          calendarEvent({
            id: "event-draft",
            status: "DRAFT",
          }),
        ],
        [eventMembership()],
        range,
        at
      )
    ).toEqual([
      {
        id: "event-a",
        cohortId: "cohort-a",
        title: "Encontro da turma",
        description: "Revisão coletiva",
        startsAt: releaseAt,
        endsAt: new Date("2026-10-20T13:00:00.000Z"),
        allDay: false,
        color: "#6B5B64",
      },
    ]);
  });

  it("honors late-join policy, ended-event consent, and cohort read window", () => {
    const eventCreatedBeforeJoin = calendarEvent({
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      publishedAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    expect(
      resolveStudentCalendarCohortEvents(
        [eventCreatedBeforeJoin],
        [
          eventMembership({
            cohort: {
              ...eventMembership().cohort,
              lateJoinPolicy: "FROM_JOIN",
            },
          }),
        ],
        range,
        at
      )
    ).toEqual([]);

    const eventEndedBeforeJoin = calendarEvent({
      startsAt: new Date("2026-09-02T12:00:00.000Z"),
      endsAt: new Date("2026-09-02T13:00:00.000Z"),
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      publishedAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    const pastRange = {
      start: new Date("2026-09-01T00:00:00.000Z"),
      end: new Date("2026-09-30T23:59:59.999Z"),
    };
    expect(
      resolveStudentCalendarCohortEvents(
        [eventEndedBeforeJoin],
        [eventMembership({ includePastReadOnly: true })],
        pastRange,
        at
      )
    ).toHaveLength(1);
    expect(
      resolveStudentCalendarCohortEvents(
        [eventEndedBeforeJoin],
        [eventMembership()],
        pastRange,
        at
      )
    ).toEqual([]);

    expect(
      resolveStudentCalendarCohortEvents(
        [calendarEvent()],
        [
          eventMembership({
            cohort: {
              ...eventMembership().cohort,
              endsAt: new Date("2026-07-01T00:00:00.000Z"),
              readAfterEndDays: 90,
            },
          }),
        ],
        range,
        at
      )
    ).toEqual([]);
  });

  it("projects a moved recurrence after join, hides cancelled dates, and keeps the original series private", () => {
    const originalStart = new Date("2026-10-01T12:00:00.000Z");
    const movedOccurrence = new Date("2026-10-08T12:00:00.000Z");
    const cancelledOccurrence = new Date("2026-10-15T12:00:00.000Z");
    const joinedAt = new Date("2026-10-12T12:00:00.000Z");

    expect(
      resolveStudentCalendarCohortEvents(
        [
          calendarEvent({
            startsAt: originalStart,
            endsAt: new Date("2026-10-01T13:00:00.000Z"),
            recurrence: "WEEKLY",
            recurrenceUntil: new Date("2026-10-29T12:00:00.000Z"),
            publishedAt: joinedAt,
            occurrenceExceptions: [
              {
                occurrenceStartsAt: movedOccurrence,
                startsAtOverride: new Date("2026-10-13T14:00:00.000Z"),
                endsAtOverride: new Date("2026-10-13T15:00:00.000Z"),
                titleOverride: "Encontro remarcado",
                descriptionOverride: null,
                colorOverride: null,
                cancelledAt: null,
                version: 2,
              },
              {
                occurrenceStartsAt: cancelledOccurrence,
                startsAtOverride: null,
                endsAtOverride: null,
                titleOverride: null,
                descriptionOverride: null,
                colorOverride: null,
                cancelledAt: new Date("2026-10-01T00:00:00.000Z"),
                version: 3,
              },
            ],
          }),
        ],
        [
          eventMembership({
            joinedAt,
            cohort: {
              ...eventMembership().cohort,
              lateJoinPolicy: "FROM_JOIN",
            },
          }),
        ],
        {
          start: new Date("2026-10-12T03:00:00.000Z"),
          end: new Date("2026-10-16T03:00:00.000Z"),
        },
        at
      )
    ).toEqual([
      {
        id: `event-a:${movedOccurrence.toISOString()}`,
        cohortId: "cohort-a",
        title: "Encontro remarcado",
        description: "Revisão coletiva",
        startsAt: new Date("2026-10-13T14:00:00.000Z"),
        endsAt: new Date("2026-10-13T15:00:00.000Z"),
        allDay: false,
        color: "#6B5B64",
      },
    ]);
  });
});

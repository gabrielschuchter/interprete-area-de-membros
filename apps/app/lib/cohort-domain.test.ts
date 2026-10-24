import { describe, expect, it } from "vitest";
import {
  accessGrantSourceIsEffective,
  cohortDateInput,
  cohortEndedReadUntil,
  cohortLifecycleStatusAt,
  cohortMembershipActiveKey,
  cohortSlugBase,
  normalizeCohortName,
  resolveCohortCourseAccess,
  resolveCohortLessonUnlockDates,
  resolveLockedCohortLessons,
} from "./cohort-domain";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("Gestão cohort domain rules", () => {
  it("normalizes names and creates stable Portuguese slugs", () => {
    expect(normalizeCohortName("  Clínica   de   São Paulo ")).toBe(
      "clínica de são paulo"
    );
    expect(cohortSlugBase("Clínica de São Paulo / 2026")).toBe(
      "clinica-de-sao-paulo-2026"
    );
  });

  it("derives lifecycle state from dates and archive state", () => {
    const cohort = {
      archivedAt: null,
      endsAt: date("2026-10-20"),
      startsAt: date("2026-10-10"),
    };
    expect(cohortLifecycleStatusAt(cohort, date("2026-10-09"))).toBe(
      "NOT_STARTED"
    );
    expect(cohortLifecycleStatusAt(cohort, date("2026-10-11"))).toBe("ACTIVE");
    expect(cohortLifecycleStatusAt(cohort, date("2026-10-20"))).toBe("ENDED");
    expect(
      cohortLifecycleStatusAt(
        { ...cohort, archivedAt: date("2026-10-12") },
        date("2026-10-11")
      )
    ).toBe("ARCHIVED");
  });

  it("uses collision-safe keys to prevent concurrent duplicate membership", () => {
    expect(cohortMembershipActiveKey("cohort:a", "member:b")).toBe(
      "cohort%3Aa:member%3Ab"
    );
    expect(cohortMembershipActiveKey("a:b", "c")).not.toBe(
      cohortMembershipActiveKey("a", "b:c")
    );
  });

  it("keeps cohort course access through the 90-day read window", () => {
    expect(cohortEndedReadUntil(date("2026-10-01"), 90)?.toISOString()).toBe(
      "2026-12-30T00:00:00.000Z"
    );
    const result = resolveCohortCourseAccess({
      cohort: {
        archivedAt: null,
        endsAt: date("2026-10-01"),
        lateJoinPolicy: "ALL_ACTIVE",
        readAfterEndDays: 90,
        startsAt: date("2026-09-01"),
      },
      membership: { joinedAt: date("2026-09-10"), leftAt: null },
      access: {
        createdAt: date("2026-09-02"),
        releaseMode: "ALL_AT_ONCE",
        revokedAt: null,
        startsAt: null,
      },
      now: date("2026-10-15"),
    });
    expect(result).toEqual({ available: true, readOnly: true });
  });

  it("applies FROM_JOIN, scheduling, membership, and revocation", () => {
    const base = {
      cohort: {
        archivedAt: null,
        endsAt: null,
        lateJoinPolicy: "FROM_JOIN" as const,
        readAfterEndDays: 90,
        startsAt: date("2026-09-01"),
      },
      membership: { joinedAt: date("2026-10-10"), leftAt: null },
      access: {
        createdAt: date("2026-10-01"),
        releaseMode: "ALL_AT_ONCE" as const,
        revokedAt: null,
        startsAt: null,
      },
      now: date("2026-10-11"),
    };
    expect(resolveCohortCourseAccess(base).available).toBe(false);
    expect(
      resolveCohortCourseAccess({
        ...base,
        cohort: {
          ...base.cohort,
          startsAt: date("2026-10-12"),
          lateJoinPolicy: "ALL_ACTIVE",
        },
      }).available
    ).toBe(false);
    expect(
      resolveCohortCourseAccess({
        ...base,
        cohort: { ...base.cohort, lateJoinPolicy: "ALL_ACTIVE" },
      }).available
    ).toBe(true);
    expect(
      resolveCohortCourseAccess({
        ...base,
        cohort: { ...base.cohort, lateJoinPolicy: "ALL_ACTIVE" },
        membership: {
          joinedAt: base.membership.joinedAt,
          leftAt: date("2026-10-10"),
        },
      }).available
    ).toBe(false);
    expect(
      resolveCohortCourseAccess({
        ...base,
        cohort: { ...base.cohort, lateJoinPolicy: "ALL_ACTIVE" },
        access: {
          ...base.access,
          createdAt: date("2026-10-10"),
          releaseMode: "SCHEDULE",
          startsAt: date("2026-10-12"),
        },
      }).available
    ).toBe(false);
    expect(
      resolveCohortCourseAccess({
        ...base,
        cohort: { ...base.cohort, lateJoinPolicy: "ALL_ACTIVE" },
        access: { ...base.access, revokedAt: date("2026-10-11") },
      }).available
    ).toBe(false);
  });
  it("treats grant validity as a request-time rule", () => {
    expect(
      accessGrantSourceIsEffective({
        now: date("2026-10-11"),
        validFrom: date("2026-10-12"),
        validUntil: null,
        revokedAt: null,
      })
    ).toBe(false);
    expect(
      accessGrantSourceIsEffective({
        now: date("2026-10-11"),
        validFrom: date("2026-10-01"),
        validUntil: date("2026-10-11"),
        revokedAt: null,
      })
    ).toBe(false);
  });
});

describe("cohort date inputs", () => {
  it("formats inclusive end dates in São Paulo time", () => {
    expect(cohortDateInput(new Date("2026-10-13T02:59:59.999Z"))).toBe(
      "2026-10-12"
    );
  });
});
describe("cohort lesson release windows", () => {
  it("locks only until every cohort path is released and respects independent access", () => {
    const locked = resolveLockedCohortLessons({
      now: date("2026-10-12"),
      lessons: [
        { id: "lesson-early", courseId: "course-a", moduleId: "module-a" },
        { id: "lesson-late", courseId: "course-a", moduleId: "module-a" },
        { id: "lesson-direct", courseId: "course-a", moduleId: "module-a" },
      ],
      accessPaths: [
        {
          courseId: "course-a",
          releases: [
            { lessonId: "lesson-early", releaseAt: date("2026-10-11") },
            { lessonId: "lesson-late", releaseAt: date("2026-10-14") },
          ],
        },
        {
          courseId: "course-a",
          releases: [
            { lessonId: "lesson-late", releaseAt: date("2026-10-13") },
          ],
        },
      ],
      independentlyGrantedCourseIds: new Set(),
      independentlyGrantedLessonIds: new Set(["lesson-direct"]),
      independentlyGrantedModuleIds: new Set(),
    });
    expect([...locked]).toEqual(["lesson-late"]);
  });
});
describe("cohort lesson unlock dates", () => {
  it("returns the earliest release among paths for locked lessons only", () => {
    const unlockDates = resolveCohortLessonUnlockDates({
      lockedLessonIds: new Set(["lesson-late"]),
      accessPaths: [
        {
          courseId: "course-a",
          releases: [
            { lessonId: "lesson-early", releaseAt: date("2026-10-11") },
            { lessonId: "lesson-late", releaseAt: date("2026-10-14") },
          ],
        },
        {
          courseId: "course-a",
          releases: [
            { lessonId: "lesson-late", releaseAt: date("2026-10-13") },
          ],
        },
      ],
    });
    expect([...unlockDates]).toEqual([["lesson-late", date("2026-10-13")]]);
  });
});

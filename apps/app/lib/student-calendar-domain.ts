import {
  cohortEndedReadUntil,
  resolveCohortCourseAccess,
} from "./cohort-domain";

export interface StudentCalendarReleaseMembership {
  readonly cohort: {
    readonly archivedAt: Date | null;
    readonly courseAccesses: readonly {
      readonly courseId: string;
      readonly createdAt: Date;
      readonly releaseMode: "ALL_AT_ONCE" | "SCHEDULE";
      readonly revokedAt: Date | null;
      readonly startsAt: Date | null;
    }[];
    readonly endsAt: Date | null;
    readonly lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN";
    readonly readAfterEndDays: number;
    readonly startsAt: Date;
  };
  readonly cohortId: string;
  readonly joinedAt: Date;
}

export interface StudentCalendarReleaseCandidate {
  readonly cohortId: string;
  readonly id: string;
  readonly lesson: {
    readonly module: {
      readonly course: { readonly id: string; readonly slug: string };
      readonly courseId: string;
    };
    readonly slug: string;
    readonly title: string;
  };
  readonly lessonId: string;
  readonly releaseAt: Date;
}

export interface StudentCalendarLessonRelease {
  readonly courseId: string;
  readonly courseSlug: string;
  readonly href: string;
  readonly id: string;
  readonly lessonId: string;
  readonly lessonSlug: string;
  readonly releaseAt: Date;
  readonly title: string;
}

export const resolveStudentCalendarLessonReleases = (
  candidates: readonly StudentCalendarReleaseCandidate[],
  memberships: readonly StudentCalendarReleaseMembership[],
  range: { readonly end: Date; readonly start: Date },
  at: Date
): StudentCalendarLessonRelease[] => {
  const membershipByCohort = new Map(
    memberships.map((membership) => [membership.cohortId, membership])
  );
  const releasesByLesson = new Map<string, StudentCalendarLessonRelease>();

  for (const candidate of candidates) {
    if (candidate.releaseAt < range.start || candidate.releaseAt > range.end) {
      continue;
    }
    const membership = membershipByCohort.get(candidate.cohortId);
    if (!membership || candidate.releaseAt < membership.joinedAt) {
      continue;
    }

    const cohort = membership.cohort;
    const readUntil = cohortEndedReadUntil(
      cohort.endsAt ?? cohort.archivedAt,
      cohort.readAfterEndDays
    );
    if (
      membership.joinedAt > at ||
      cohort.startsAt > at ||
      (readUntil && at >= readUntil)
    ) {
      continue;
    }

    const courseId = candidate.lesson.module.courseId;
    const courseAccess = cohort.courseAccesses.find(
      (access) =>
        access.courseId === courseId &&
        resolveCohortCourseAccess({
          access,
          cohort,
          membership: { joinedAt: membership.joinedAt, leftAt: null },
          now: candidate.releaseAt,
        }).available
    );
    if (!courseAccess) {
      continue;
    }

    const lessonRelease: StudentCalendarLessonRelease = {
      id: candidate.id,
      lessonId: candidate.lessonId,
      title: candidate.lesson.title,
      lessonSlug: candidate.lesson.slug,
      courseId,
      courseSlug: candidate.lesson.module.course.slug,
      releaseAt: candidate.releaseAt,
      href: `/aprender/cursos/${candidate.lesson.module.course.slug}/${candidate.lesson.slug}`,
    };
    const current = releasesByLesson.get(candidate.lessonId);
    if (
      !current ||
      lessonRelease.releaseAt < current.releaseAt ||
      (lessonRelease.releaseAt.getTime() === current.releaseAt.getTime() &&
        lessonRelease.id.localeCompare(current.id) < 0)
    ) {
      releasesByLesson.set(candidate.lessonId, lessonRelease);
    }
  }

  return [...releasesByLesson.values()].sort(
    (left, right) =>
      left.releaseAt.getTime() - right.releaseAt.getTime() ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
  );
};

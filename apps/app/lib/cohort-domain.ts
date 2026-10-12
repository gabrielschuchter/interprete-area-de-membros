export type CohortLifecycleStatus =
  | "ACTIVE"
  | "NOT_STARTED"
  | "ENDED"
  | "ARCHIVED";

export type LateJoinPolicy = "ALL_ACTIVE" | "FROM_JOIN";
export type CohortReleaseMode = "ALL_AT_ONCE" | "SCHEDULE";

const whitespacePattern = /\s+/gu;
const combiningMarksPattern = /[\u0300-\u036f]/gu;
const nonSlugCharactersPattern = /[^a-z0-9]+/gu;
const edgeHyphensPattern = /(^-|-$)/gu;
const trailingHyphenPattern = /-$/u;

export interface CohortLifecycleDates {
  readonly archivedAt: Date | null;
  readonly endsAt: Date | null;
  readonly startsAt: Date;
}

export interface CohortCourseAccessContext {
  readonly access: {
    readonly createdAt: Date;
    readonly releaseMode: CohortReleaseMode;
    readonly startsAt: Date | null;
    readonly revokedAt: Date | null;
  };
  readonly cohort: CohortLifecycleDates & {
    readonly lateJoinPolicy: LateJoinPolicy;
    readonly readAfterEndDays: number;
  };
  readonly membership: {
    readonly joinedAt: Date;
    readonly leftAt: Date | null;
  };
  readonly now: Date;
}

export const cohortLifecycleStatusAt = (
  cohort: CohortLifecycleDates,
  now: Date
): CohortLifecycleStatus => {
  if (cohort.archivedAt) {
    return "ARCHIVED";
  }
  if (cohort.startsAt > now) {
    return "NOT_STARTED";
  }
  if (cohort.endsAt && cohort.endsAt <= now) {
    return "ENDED";
  }
  return "ACTIVE";
};

export const normalizeCohortName = (name: string) =>
  name
    .normalize("NFKC")
    .trim()
    .replace(whitespacePattern, " ")
    .toLocaleLowerCase("pt-BR");

export const cohortSlugBase = (name: string) =>
  normalizeCohortName(name)
    .normalize("NFD")
    .replace(combiningMarksPattern, "")
    .replace(nonSlugCharactersPattern, "-")
    .replace(edgeHyphensPattern, "")
    .slice(0, 72)
    .replace(trailingHyphenPattern, "") || "turma";

export const cohortMembershipActiveKey = (cohortId: string, memberId: string) =>
  `${encodeURIComponent(cohortId)}:${encodeURIComponent(memberId)}`;

export const cohortEndedReadUntil = (
  endsAt: Date | null,
  readAfterEndDays: number
) => {
  if (!endsAt) {
    return null;
  }
  const result = new Date(endsAt);
  result.setUTCDate(result.getUTCDate() + readAfterEndDays);
  return result;
};

export const resolveCohortCourseAccess = ({
  access,
  cohort,
  membership,
  now,
}: CohortCourseAccessContext) => {
  if (access.revokedAt || membership.leftAt || cohort.startsAt > now) {
    return { available: false, readOnly: false };
  }

  if (
    cohort.lateJoinPolicy === "FROM_JOIN" &&
    access.createdAt < membership.joinedAt
  ) {
    return { available: false, readOnly: false };
  }

  if (
    access.releaseMode === "SCHEDULE" &&
    (!access.startsAt || access.startsAt > now)
  ) {
    return { available: false, readOnly: false };
  }
  if (access.startsAt && access.startsAt > now) {
    return { available: false, readOnly: false };
  }

  const readUntil = cohortEndedReadUntil(
    cohort.endsAt ?? cohort.archivedAt,
    cohort.readAfterEndDays
  );
  if (readUntil && now >= readUntil) {
    return { available: false, readOnly: false };
  }

  const cohortEnd = cohort.endsAt ?? cohort.archivedAt;
  const isEnded = Boolean(cohortEnd && now >= cohortEnd);
  return { available: true, readOnly: isEnded };
};

export const accessGrantSourceIsEffective = (input: {
  readonly now: Date;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly revokedAt: Date | null;
}) =>
  input.revokedAt === null &&
  input.validFrom <= input.now &&
  (input.validUntil === null || input.validUntil > input.now);

export interface CohortLessonReleasePath {
  readonly courseId: string;
  readonly releases: readonly {
    readonly lessonId: string;
    readonly releaseAt: Date;
  }[];
}

export const resolveLockedCohortLessons = (input: {
  readonly accessPaths: readonly CohortLessonReleasePath[];
  readonly independentlyGrantedCourseIds: ReadonlySet<string>;
  readonly independentlyGrantedLessonIds: ReadonlySet<string>;
  readonly independentlyGrantedModuleIds: ReadonlySet<string>;
  readonly lessons: readonly {
    readonly courseId: string;
    readonly id: string;
    readonly moduleId: string;
  }[];
  readonly now: Date;
}) => {
  const pathsByCourse = new Map<string, readonly ReadonlyMap<string, Date>[]>();
  for (const path of input.accessPaths) {
    const paths = pathsByCourse.get(path.courseId) ?? [];
    pathsByCourse.set(path.courseId, [
      ...paths,
      new Map(
        path.releases.map(({ lessonId, releaseAt }) => [lessonId, releaseAt])
      ),
    ]);
  }

  const locked = new Set<string>();
  for (const lesson of input.lessons) {
    if (
      input.independentlyGrantedCourseIds.has(lesson.courseId) ||
      input.independentlyGrantedLessonIds.has(lesson.id) ||
      input.independentlyGrantedModuleIds.has(lesson.moduleId)
    ) {
      continue;
    }
    const paths = pathsByCourse.get(lesson.courseId) ?? [];
    const blockedByEveryPath =
      paths.length > 0 &&
      paths.every((releases) => {
        const releaseAt = releases.get(lesson.id);
        return Boolean(releaseAt && releaseAt > input.now);
      });
    if (blockedByEveryPath) {
      locked.add(lesson.id);
    }
  }
  return locked;
};

export const cohortDateInput = (value: Date | null) => {
  if (!value) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

import "server-only";

import { AccessResourceType, database } from "@repo/database";

export interface CourseReadinessLesson {
  readonly assets: readonly unknown[];
  readonly kind: string;
  readonly resources: readonly unknown[];
  readonly status: string;
}

export interface CourseReadinessItem {
  readonly detail?: string;
  readonly key: string;
  readonly label: string;
  readonly state: "ok" | "warn";
}

export interface CourseAccessSummary {
  readonly cohorts: number;
  readonly direct: number;
}

export const getCourseAccessSummary = async (
  courseId: string
): Promise<CourseAccessSummary> => {
  const [cohorts, direct] = await Promise.all([
    database.cohortCourseAccess.count({
      where: { courseId, revokedAt: null, cohort: { archivedAt: null } },
    }),
    database.accessGrantSource.count({
      where: {
        resourceType: AccessResourceType.COURSE,
        resourceId: courseId,
        revokedAt: null,
        subjectCohortId: null,
      },
    }),
  ]);
  return { cohorts, direct };
};

export const courseReadiness = ({
  access,
  course,
  lessons,
}: {
  readonly access: CourseAccessSummary;
  readonly course: {
    readonly coverUrl: string | null;
    readonly description: string | null;
  };
  readonly lessons: readonly CourseReadinessLesson[];
}): readonly CourseReadinessItem[] => {
  const published = lessons.filter((lesson) => lesson.status === "PUBLISHED");
  const incomplete = lessons.filter(
    (lesson) =>
      (lesson.kind === "VIDEO" || lesson.kind === "MIXED") &&
      lesson.assets.length === 0
  );
  const missingCover = course.coverUrl ? [] : ["capa"];
  const missingDescription = course.description?.trim() ? [] : ["descrição"];
  const missing = [...missingCover, ...missingDescription];
  let accessDetail = "";
  if (access.cohorts > 0) {
    accessDetail = `${access.cohorts} ${access.cohorts === 1 ? "turma" : "turmas"}`;
  } else if (access.direct > 0) {
    accessDetail = "acesso direto ou aberto";
  }
  return [
    {
      key: "cover",
      label: "Capa e descrição",
      state: missing.length === 0 ? "ok" : "warn",
      detail: missing.length === 0 ? undefined : `Falta ${missing.join(" e ")}`,
    },
    {
      key: "lesson",
      label: "Pelo menos uma aula publicada",
      state: published.length > 0 ? "ok" : "warn",
    },
    {
      key: "media",
      label: "Aulas com vídeo e materiais",
      state: incomplete.length === 0 && lessons.length > 0 ? "ok" : "warn",
      detail:
        incomplete.length > 0
          ? `${incomplete.length} ${incomplete.length === 1 ? "aula sem vídeo" : "aulas sem vídeo"}`
          : undefined,
    },
    {
      key: "access",
      label: "Acesso definido",
      state: accessDetail ? "ok" : "warn",
      detail: accessDetail || "Nenhuma turma ou acesso direto",
    },
  ];
};

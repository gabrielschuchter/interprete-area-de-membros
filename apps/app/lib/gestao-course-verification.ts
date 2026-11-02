import "server-only";

import { getAdminCourse } from "@/lib/admin-learning";
import {
  type CourseReadinessItem,
  courseReadiness,
  getCourseAccessSummary,
} from "@/lib/gestao-course-readiness";

export interface CourseVerification {
  readonly items: readonly CourseReadinessItem[];
  readonly ok: boolean;
  readonly summary: string;
}

const hasText = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const node = value as { content?: unknown; text?: unknown; type?: unknown };
  if (typeof node.text === "string" && node.text.trim()) {
    return true;
  }
  if (node.type === "image" || node.type === "communityVideo") {
    return true;
  }
  return Array.isArray(node.content) && node.content.some(hasText);
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Confere se o curso está pronto para o aluno: os critérios de prontidão e
 * os problemas de estrutura que só aparecem quando alguém abre o curso.
 */
export const verifyCoursePublication = async (
  courseId: string
): Promise<CourseVerification | null> => {
  const course = await getAdminCourse(courseId);
  if (!course) {
    return null;
  }
  const lessons = course.modules.flatMap((module) => module.lessons);
  const access = await getCourseAccessSummary(course.id);
  const items: CourseReadinessItem[] = [
    ...courseReadiness({ access, course, lessons }),
  ];

  const publishedModules = course.modules.filter(
    (module) => module.status === "PUBLISHED"
  );
  const emptyModules = publishedModules.filter(
    (module) => !module.lessons.some((lesson) => lesson.status === "PUBLISHED")
  );
  let modulesDetail: string | undefined;
  if (publishedModules.length === 0) {
    modulesDetail = "Nenhum módulo publicado";
  } else if (emptyModules.length > 0) {
    modulesDetail = `${plural(emptyModules.length, "módulo publicado sem aula publicada", "módulos publicados sem aula publicada")}: ${emptyModules.map((module) => module.title).join(", ")}`;
  }
  items.push({
    key: "modules",
    label: "Módulos publicados com aulas publicadas",
    state: modulesDetail ? "warn" : "ok",
    detail: modulesDetail,
  });

  const publishedLessons = lessons.filter(
    (lesson) => lesson.status === "PUBLISHED"
  );
  const blank = publishedLessons.filter(
    (lesson) => lesson.assets.length === 0 && !hasText(lesson.content)
  );
  items.push({
    key: "content",
    label: "Aulas publicadas com conteúdo",
    state: blank.length === 0 ? "ok" : "warn",
    detail:
      blank.length > 0
        ? `${plural(blank.length, "aula publicada vazia", "aulas publicadas vazias")}: ${blank
            .slice(0, 3)
            .map((lesson) => lesson.title)
            .join(", ")}${blank.length > 3 ? "…" : ""}`
        : undefined,
  });

  const hidden = lessons.length - publishedLessons.length;
  items.push({
    key: "drafts",
    label: "Aulas fora da publicação",
    state: "ok",
    detail:
      hidden > 0
        ? `${plural(hidden, "aula em rascunho continua oculta", "aulas em rascunho continuam ocultas")} para os alunos`
        : "Todas as aulas estão publicadas",
  });

  const problems = items.filter((item) => item.state === "warn").length;
  return {
    items,
    ok: problems === 0,
    summary:
      problems === 0
        ? "Tudo certo: o curso está pronto para os alunos."
        : `${plural(problems, "ponto precisa", "pontos precisam")} de atenção antes de publicar.`,
  };
};

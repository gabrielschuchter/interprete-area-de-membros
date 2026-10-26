import "server-only";

import { database } from "@repo/database";
import { env } from "@/env";
import { getMemberIdentitySnapshot } from "@/lib/auth";
import { requireMemberId } from "@/lib/learning";

interface EditInGestaoBarProperties {
  readonly courseSlug: string;
  readonly lessonSlug?: string;
}

const resolveTarget = async ({
  courseSlug,
  lessonSlug,
}: EditInGestaoBarProperties) => {
  if (lessonSlug) {
    const lesson = await database.lesson.findFirst({
      where: {
        slug: lessonSlug,
        module: { is: { course: { is: { slug: courseSlug } } } },
      },
      select: { id: true, module: { select: { courseId: true } } },
    });
    if (lesson) {
      return {
        href: `/gestao/ensino/cursos/${lesson.module.courseId}/aulas/${lesson.id}`,
        label: "Editar esta aula na Gestão",
      };
    }
  }
  const course = await database.course.findFirst({
    where: { slug: courseSlug },
    select: { id: true },
  });
  return course
    ? {
        href: `/gestao/ensino/cursos/${course.id}`,
        label: "Editar este curso na Gestão",
      }
    : null;
};

/**
 * Barra do professor na página que o aluno também vê. Só aparece para quem
 * pode gerir conteúdo (professor ou administrador) e nunca durante a prévia,
 * porque ali a identidade é a do aluno.
 */
export const EditInGestaoBar = async (
  properties: EditInGestaoBarProperties
) => {
  if (env.GESTAO_V2_ENABLED !== "true") {
    return null;
  }
  const member = await getMemberIdentitySnapshot(await requireMemberId());
  if (!member || (member.role !== "TEACHER" && member.role !== "ADMIN")) {
    return null;
  }
  const target = await resolveTarget(properties);
  if (!target) {
    return null;
  }
  return (
    <div
      style={{
        alignItems: "center",
        background: "#410230",
        color: "#fff",
        display: "flex",
        font: "500 13px/1 var(--font-sans-family, system-ui, sans-serif)",
        gap: 12,
        justifyContent: "space-between",
        minHeight: 40,
        padding: "0 16px",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <span>Você está vendo a página como o aluno a vê.</span>
      <a
        href={target.href}
        style={{
          background: "#fff",
          borderRadius: 6,
          color: "#410230",
          fontWeight: 600,
          padding: "8px 12px",
          textDecoration: "none",
        }}
      >
        {target.label}
      </a>
    </div>
  );
};

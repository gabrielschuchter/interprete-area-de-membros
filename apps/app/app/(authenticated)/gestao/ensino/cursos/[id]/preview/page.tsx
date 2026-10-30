import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/app/(authenticated)/cursos/cursos.css";
import { buildCoursePreviewData } from "@/components/learning/cursos/course-data";
import { CourseView } from "@/components/learning/cursos/course-view";
import { getAdminCourse } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";

const statusNote = {
  ARCHIVED: "Arquivado: os alunos não veem este curso.",
  DRAFT: "Rascunho: os alunos ainda não veem este curso.",
  PUBLISHED: "Publicado: é assim que um aluno com acesso vê o curso.",
  SCHEDULED: "Agendado: os alunos veem o curso quando chegar a data.",
} as const;

const GestaoCoursePreview = async ({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  await requireGestaoAction("content.manage", { contentId: id });
  const course = await getAdminCourse(id);
  if (!course) {
    notFound();
  }
  const hiddenLessons = course.modules
    .flatMap((module) => module.lessons)
    .filter((lesson) => lesson.status !== "PUBLISHED").length;

  return (
    <main className="gca-preview-page">
      <div className="gca-preview-topline">
        <p>
          Prévia oficial · mesma tela do aluno · somente leitura, sem alterar
          progresso. {statusNote[course.status]}
          {hiddenLessons > 0
            ? ` ${hiddenLessons} ${hiddenLessons === 1 ? "aula fora da publicação não aparece" : "aulas fora da publicação não aparecem"}.`
            : ""}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/gestao/ensino/cursos/${encodeURIComponent(course.id)}/publicacao`}
              prefetch={false}
            >
              Verificar publicação
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/gestao/ensino/cursos/${encodeURIComponent(course.id)}`}
              prefetch={false}
            >
              Voltar ao curso
            </Link>
          </Button>
        </div>
      </div>
      <CourseView
        data={buildCoursePreviewData({
          ...course,
          coverUrl: course.coverUrl,
          modules: course.modules,
        })}
      />
    </main>
  );
};

export default GestaoCoursePreview;

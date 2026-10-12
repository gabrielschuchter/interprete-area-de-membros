import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichDocument } from "@/components/learning/rich-document";
import { getAdminCourse } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";

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

  return (
    <main className="gca-preview-page">
      <div className="gca-preview-topline">
        <p>
          Prévia privada · somente leitura · não altera o progresso do aluno
        </p>
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/gestao/ensino/cursos/${encodeURIComponent(course.id)}/turmas`}
            prefetch={false}
          >
            Voltar ao curso
          </Link>
        </Button>
      </div>
      <p className="gca-preview-eyebrow">
        {course.learningPath?.title ?? "Sem percurso"} · /{course.slug}
      </p>
      <h1>{course.title}</h1>
      {course.subtitle ? (
        <p className="gca-preview-subtitle">{course.subtitle}</p>
      ) : null}
      {course.description ? (
        <p className="gca-preview-description">{course.description}</p>
      ) : null}
      <div className="gca-preview-modules">
        {course.modules.map((module, moduleIndex) => (
          <section className="gca-preview-module" key={module.id}>
            <p className="gca-preview-eyebrow">Módulo {moduleIndex + 1}</p>
            <h2>{module.title}</h2>
            {module.description ? <p>{module.description}</p> : null}
            <div className="gca-preview-lessons">
              {module.lessons.map((lesson) => (
                <article className="gca-preview-lesson" key={lesson.id}>
                  <span>
                    {lesson.kind} · {lesson.status}
                  </span>
                  <h3>{lesson.title}</h3>
                  {lesson.description ? <p>{lesson.description}</p> : null}
                  <RichDocument value={lesson.content} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
};

export default GestaoCoursePreview;

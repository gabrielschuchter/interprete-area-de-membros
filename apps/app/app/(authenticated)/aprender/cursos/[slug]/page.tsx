import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ListTreeIcon,
  PlayCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { getPublishedCourse, requireMemberId } from "@/lib/learning";

export const dynamic = "force-dynamic";

interface CoursePageProperties {
  readonly params: Promise<{ slug: string }>;
}

const CoursePage = async ({ params }: CoursePageProperties) => {
  const { slug } = await params;
  const memberId = await requireMemberId();
  const course = await getPublishedCourse(slug, memberId);

  if (!course) {
    notFound();
  }

  const lessons = course.modules.flatMap((module) => module.lessons);
  const nextLesson = lessons.find(
    (lesson) => !lesson.progress.some(({ status }) => status === "COMPLETED")
  );

  return (
    <LearningPageFrame
      description={
        course.description ??
        "Percorra os módulos, leia as aulas e escolha a próxima pergunta para continuar."
      }
      eyebrow={`${course.learningPath?.title ?? "Aprender"} · curso`}
      title={course.title}
    >
      <section className="grid gap-8 border-y py-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)] lg:gap-12 lg:py-10">
        <div className="flex flex-col justify-center">
          <p className="brand-eyebrow">Aula seguinte</p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl leading-[1.08] sm:text-5xl">
            {nextLesson ? nextLesson.title : "Você concluiu este curso."}
          </h2>
          <p className="mt-5 max-w-xl text-muted-foreground leading-7">
            {nextLesson?.description ??
              "Você pode revisitar qualquer aula publicada para consolidar o raciocínio antes de seguir para um novo percurso."}
          </p>
          {nextLesson && (
            <Button asChild className="mt-8 w-fit">
              <Link href={`/aprender/cursos/${course.slug}/${nextLesson.slug}`}>
                {course.progress.completedLessons > 0
                  ? "Continuar aula"
                  : "Começar primeira aula"}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
        <div className="paper-surface border p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="brand-eyebrow">Seu progresso</p>
              <p className="mt-3 font-display text-4xl text-brand-structural">
                {course.progress.percentage}%
              </p>
            </div>
            <span className="font-data text-muted-foreground text-xs">
              {course.progress.completedLessons}/{course.progress.totalLessons}
            </span>
          </div>
          <Progress
            aria-label={`${course.progress.percentage}% do curso concluído`}
            className="mt-6 h-2.5"
            value={course.progress.percentage}
          />
          <div className="mt-7 grid grid-cols-2 gap-4 border-t pt-5">
            <div>
              <p className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                Módulos
              </p>
              <p className="mt-2 font-display text-2xl">
                {course.modules.length}
              </p>
            </div>
            <div>
              <p className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                Aulas
              </p>
              <p className="mt-2 font-display text-2xl">{lessons.length}</p>
            </div>
          </div>
        </div>
      </section>

      {course.modules.length === 0 ? (
        <section className="paper-surface flex min-h-64 flex-col items-start justify-center border p-7 sm:p-10">
          <ListTreeIcon
            aria-hidden="true"
            className="size-6 text-brand-action"
          />
          <p className="brand-eyebrow mt-6">Estrutura do curso</p>
          <h2 className="mt-3 font-display text-3xl">
            Ainda não há módulos publicados.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground leading-7">
            O curso está visível, mas o conteúdo só aparecerá quando a equipe
            publicar o primeiro módulo e suas aulas.
          </p>
        </section>
      ) : (
        <section className="space-y-7">
          <div className="border-b pb-5">
            <p className="brand-eyebrow">Conteúdo do curso</p>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              Módulos e aulas
            </h2>
          </div>
          <div className="space-y-8">
            {course.modules.map((module, moduleIndex) => {
              const completed = module.lessons.filter((lesson) =>
                lesson.progress.some(({ status }) => status === "COMPLETED")
              ).length;

              return (
                <section
                  className="border-b pb-8 last:border-b-0"
                  key={module.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="font-data text-brand-action text-sm">
                        {String(moduleIndex + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="brand-eyebrow">Módulo</p>
                        <h3 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
                          {module.title}
                        </h3>
                      </div>
                    </div>
                    <span className="font-data text-muted-foreground text-xs sm:pt-1">
                      {completed}/{module.lessons.length} concluídas
                    </span>
                  </div>

                  {module.lessons.length === 0 ? (
                    <p className="mt-6 border-border border-l-2 pl-4 text-muted-foreground text-sm leading-6">
                      Nenhuma aula publicada neste módulo.
                    </p>
                  ) : (
                    <ol className="mt-6 divide-y border-y">
                      {module.lessons.map((lesson, lessonIndex) => {
                        const isCompleted = lesson.progress.some(
                          ({ status }) => status === "COMPLETED"
                        );

                        return (
                          <li key={lesson.id}>
                            <Link
                              className="group flex min-h-20 items-center gap-4 px-3 py-4 transition-colors hover:bg-brand-action/5 sm:px-4"
                              href={`/aprender/cursos/${course.slug}/${lesson.slug}`}
                            >
                              <span className="font-data text-muted-foreground text-xs">
                                {moduleIndex + 1}.{lessonIndex + 1}
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="font-medium leading-6 transition-colors group-hover:text-brand-structural">
                                  {lesson.title}
                                </span>
                                {lesson.description && (
                                  <span className="line-clamp-2 text-muted-foreground text-sm leading-5">
                                    {lesson.description}
                                  </span>
                                )}
                              </span>
                              {isCompleted ? (
                                <CheckCircle2Icon
                                  aria-label="Aula concluída"
                                  className="size-5 shrink-0 text-brand-action"
                                />
                              ) : (
                                <PlayCircleIcon
                                  aria-label="Abrir aula"
                                  className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-action"
                                />
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-6 border-t pt-8 sm:grid-cols-3">
        {[
          ["Leia", "Não pule a pergunta que abre cada aula."],
          ["Anote", "Registre o ponto em que a evidência muda a sua leitura."],
          ["Retome", "O caminho permanece aberto para uma segunda passagem."],
        ].map(([title, description], index) => (
          <div className="border-brand-action/60 border-l-2 pl-4" key={title}>
            <span className="font-data text-brand-action text-xs">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 font-display text-2xl">{title}</h3>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              {description}
            </p>
          </div>
        ))}
      </section>
    </LearningPageFrame>
  );
};

export default CoursePage;

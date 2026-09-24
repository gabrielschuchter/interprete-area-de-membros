import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CircleDotIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { getPublishedLearningPath, requireMemberId } from "@/lib/learning";

export const dynamic = "force-dynamic";

interface LearningPathPageProperties {
  readonly params: Promise<{ slug: string }>;
}

const LearningPathPage = async ({ params }: LearningPathPageProperties) => {
  const { slug } = await params;
  const memberId = await requireMemberId();
  const path = await getPublishedLearningPath(slug, memberId);

  if (!path) {
    notFound();
  }

  const totalLessons = path.courses.reduce(
    (total, course) => total + course.lessonCount,
    0
  );
  const completedLessons = path.courses.reduce(
    (total, course) => total + course.progress.completedLessons,
    0
  );
  const progress =
    totalLessons === 0
      ? 0
      : Math.round((completedLessons / totalLessons) * 100);
  const firstOpenCourse = path.courses.find(
    (course) => course.progress.completedLessons < course.progress.totalLessons
  );

  return (
    <LearningPageFrame
      description={
        path.description ??
        "Uma sequência de cursos para orientar seus próximos passos de estudo."
      }
      eyebrow="Trilha de aprendizagem · percurso completo"
      title={path.title}
    >
      <section className="grid gap-8 border-y py-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)] lg:gap-12 lg:py-10">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 font-data text-muted-foreground text-xs uppercase tracking-[0.14em]">
            <BookOpenIcon
              aria-hidden="true"
              className="size-4 text-brand-action"
            />
            <span>
              {path.courses.length}{" "}
              {path.courses.length === 1 ? "curso" : "cursos"} · {totalLessons}{" "}
              {totalLessons === 1 ? "aula" : "aulas"}
            </span>
          </div>
          <h2 className="mt-5 max-w-2xl font-display text-3xl leading-[1.08] sm:text-5xl">
            Um caminho não é uma fila de conteúdos. É uma sequência de decisões.
          </h2>
          <p className="mt-5 max-w-xl text-muted-foreground leading-7">
            Siga a ordem sugerida para construir repertório, mas volte sempre
            que uma pergunta pedir uma segunda leitura.
          </p>
          {firstOpenCourse && (
            <Button asChild className="mt-8 w-fit">
              <Link href={`/aprender/cursos/${firstOpenCourse.slug}`}>
                {completedLessons > 0 ? "Continuar trilha" : "Começar trilha"}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
        <div className="paper-surface border p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="brand-eyebrow">Progresso da trilha</p>
              <p className="mt-3 font-display text-4xl text-brand-structural">
                {progress}%
              </p>
            </div>
            <span className="font-data text-brand-action text-xs">
              {completedLessons}/{totalLessons}
            </span>
          </div>
          <Progress
            aria-label={`${progress}% da trilha concluída`}
            className="mt-6 h-2.5"
            value={progress}
          />
          <p className="mt-5 text-muted-foreground text-sm leading-6">
            O percurso é salvo por aula. Concluir uma aula não impede revisitar
            o conteúdo quando uma nova dúvida aparecer.
          </p>
        </div>
      </section>

      <section className="space-y-7">
        <div className="border-b pb-5">
          <p className="brand-eyebrow">Sequência sugerida</p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            Os capítulos deste percurso
          </h2>
        </div>
        <ol className="relative border-brand-action/40 border-l">
          {path.courses.map((course, index) => {
            const isComplete =
              course.progress.completedLessons ===
                course.progress.totalLessons &&
              course.progress.totalLessons > 0;

            return (
              <li
                className="relative pb-8 pl-7 last:pb-0 sm:pl-10"
                key={course.id}
              >
                <span className="absolute top-0 -left-[0.55rem] flex size-4 items-center justify-center bg-background text-brand-action">
                  {isComplete ? (
                    <CheckCircle2Icon
                      aria-label="Curso concluído"
                      className="size-4"
                    />
                  ) : (
                    <CircleDotIcon
                      aria-label="Curso em andamento"
                      className="size-4"
                    />
                  )}
                </span>
                <div className="flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="font-data text-brand-action text-xs">
                      Curso {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
                      <Link
                        className="underline decoration-brand-action/40 underline-offset-8 transition-colors hover:text-brand-structural"
                        href={`/aprender/cursos/${course.slug}`}
                      >
                        {course.title}
                      </Link>
                    </h3>
                    {course.description && (
                      <p className="mt-3 max-w-2xl text-muted-foreground leading-6">
                        {course.description}
                      </p>
                    )}
                    <p className="mt-4 font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                      {course.moduleCount}{" "}
                      {course.moduleCount === 1 ? "módulo" : "módulos"} ·{" "}
                      {course.lessonCount}{" "}
                      {course.lessonCount === 1 ? "aula" : "aulas"}
                    </p>
                  </div>
                  <div className="flex min-w-44 flex-col gap-3 sm:items-end">
                    <span className="font-data text-muted-foreground text-xs">
                      {course.progress.completedLessons}/
                      {course.progress.totalLessons} concluídas
                    </span>
                    <Progress
                      aria-label={`${course.progress.percentage}% do curso concluído`}
                      value={course.progress.percentage}
                    />
                    <Link
                      className="inline-flex min-h-11 items-center gap-2 text-brand-structural text-sm underline decoration-brand-action/40 underline-offset-4 hover:text-brand-action"
                      href={`/aprender/cursos/${course.slug}`}
                    >
                      Ver curso
                      <ArrowRightIcon aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </LearningPageFrame>
  );
};

export default LearningPathPage;

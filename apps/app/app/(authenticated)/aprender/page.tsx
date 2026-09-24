import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CompassIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { getPublishedLearningPaths, requireMemberId } from "@/lib/learning";

export const dynamic = "force-dynamic";

const LearnPage = async () => {
  const memberId = await requireMemberId();
  const paths = await getPublishedLearningPaths(memberId);
  const courses = paths.flatMap((path) => path.courses);
  const totalLessons = courses.reduce(
    (total, course) => total + course.lessonCount,
    0
  );
  const completedLessons = courses.reduce(
    (total, course) => total + course.progress.completedLessons,
    0
  );
  const overallProgress =
    totalLessons === 0
      ? 0
      : Math.round((completedLessons / totalLessons) * 100);
  const nextCourse = courses.find(
    (course) => course.progress.completedLessons < course.progress.totalLessons
  );

  return (
    <LearningPageFrame
      description="Um percurso para buscar, ler e interpretar evidência com mais autonomia — uma pergunta de cada vez."
      eyebrow="Estudo guiado · método antes do veredito"
      title="Aprender é tornar o raciocínio visível."
    >
      {paths.length === 0 ? (
        <section className="paper-surface grid overflow-hidden border shadow-[var(--shadow-paper)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.82fr)]">
          <div className="flex flex-col items-start justify-center p-7 sm:p-12">
            <div className="flex size-12 items-center justify-center border border-brand-action/40 text-brand-action">
              <CompassIcon aria-hidden="true" className="size-5" />
            </div>
            <p className="brand-eyebrow mt-8">
              O percurso está sendo preparado
            </p>
            <h2 className="mt-4 max-w-xl font-display text-3xl leading-[1.08] tracking-tight sm:text-5xl">
              Toda leitura começa antes do primeiro parágrafo.
            </h2>
            <p className="mt-5 max-w-xl text-muted-foreground leading-7">
              Ainda não há uma trilha publicada para a sua turma. Quando o
              conteúdo estiver disponível, ele aparecerá aqui com a sequência,
              as aulas e o seu progresso real.
            </p>
          </div>
          <figure className="relative min-h-72 border-t bg-brand-depth/10 lg:border-t-0 lg:border-l">
            <Image
              alt="Artigo e anotações em uma tela de estudo."
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              src="/brand/learning/evidence-screen.png"
            />
          </figure>
        </section>
      ) : (
        <>
          <section className="grid gap-8 border-y py-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)] lg:gap-12 lg:py-10">
            <div className="flex flex-col justify-center">
              <p className="brand-eyebrow">Seu ponto de partida</p>
              <h2 className="mt-4 max-w-2xl font-display text-3xl leading-[1.08] tracking-tight sm:text-5xl">
                {nextCourse
                  ? "Continue de onde a sua pergunta ficou."
                  : "Você percorreu este capítulo inteiro."}
              </h2>
              <p className="mt-5 max-w-xl text-muted-foreground leading-7">
                {nextCourse
                  ? "A sequência abaixo é organizada para que cada aula prepare a próxima. Você pode voltar, reler e avançar sem perder o fio do método."
                  : "Revisitar uma aula também é parte da prática baseada em evidências. Escolha um curso para reler o caminho ou aguarde a próxima trilha publicada."}
              </p>
              {nextCourse && (
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button asChild>
                    <Link href={`/aprender/cursos/${nextCourse.slug}`}>
                      Continuar estudo
                      <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                  <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.14em]">
                    {nextCourse.title}
                  </span>
                </div>
              )}
            </div>
            <div className="paper-surface border p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="brand-eyebrow">Percurso até aqui</p>
                  <p className="mt-3 font-display text-4xl text-brand-structural">
                    {overallProgress}%
                  </p>
                </div>
                <BookOpenIcon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
              </div>
              <Progress
                aria-label={`${overallProgress}% do percurso concluído`}
                className="mt-6 h-2.5"
                value={overallProgress}
              />
              <div className="mt-4 flex items-center justify-between gap-4 font-data text-muted-foreground text-xs">
                <span>{completedLessons} aulas concluídas</span>
                <span>{totalLessons} aulas publicadas</span>
              </div>
              <div className="mt-8 border-t pt-5">
                <p className="text-muted-foreground text-sm leading-6">
                  O progresso é salvo por aula e pertence somente à sua conta.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-7">
            <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="brand-eyebrow">Mapa de estudo</p>
                <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
                  Trilhas para pensar com mais clareza
                </h2>
              </div>
              <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.14em]">
                {paths.length} {paths.length === 1 ? "trilha" : "trilhas"}
              </span>
            </div>

            <div className="space-y-10">
              {paths.map((path, pathIndex) => {
                const pathLessons = path.courses.reduce(
                  (total, course) => total + course.lessonCount,
                  0
                );
                const pathCompleted = path.courses.reduce(
                  (total, course) => total + course.progress.completedLessons,
                  0
                );
                const pathProgress =
                  pathLessons === 0
                    ? 0
                    : Math.round((pathCompleted / pathLessons) * 100);

                return (
                  <section className="relative" key={path.id}>
                    <div className="flex flex-col gap-5 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex items-start gap-4">
                        <span className="font-data text-brand-action text-sm">
                          {String(pathIndex + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="brand-eyebrow">
                            Trilha de aprendizagem
                          </p>
                          <h3 className="mt-2 font-display text-3xl leading-tight">
                            <Link
                              className="underline decoration-brand-action/40 underline-offset-8 transition-colors hover:text-brand-structural"
                              href={`/aprender/trilhas/${path.slug}`}
                            >
                              {path.title}
                            </Link>
                          </h3>
                          {path.description && (
                            <p className="mt-3 max-w-2xl text-muted-foreground leading-6">
                              {path.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="min-w-44 sm:text-right">
                        <div className="flex items-center justify-between gap-4 font-data text-muted-foreground text-xs sm:justify-end">
                          <span>
                            {pathCompleted}/{pathLessons} aulas
                          </span>
                          <span>{pathProgress}%</span>
                        </div>
                        <Progress
                          aria-label={`${pathProgress}% da trilha concluída`}
                          className="mt-3"
                          value={pathProgress}
                        />
                      </div>
                    </div>

                    <div className="divide-y border-b">
                      {path.courses.map((course, courseIndex) => {
                        const completed =
                          course.progress.completedLessons ===
                            course.progress.totalLessons &&
                          course.progress.totalLessons > 0;

                        return (
                          <Link
                            className="group flex min-h-24 items-center gap-4 py-5 transition-colors hover:bg-brand-action/5 sm:gap-6 sm:px-4"
                            href={`/aprender/cursos/${course.slug}`}
                            key={course.id}
                          >
                            <span className="font-data text-muted-foreground text-xs">
                              {pathIndex + 1}.{courseIndex + 1}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="font-display text-xl leading-tight transition-colors group-hover:text-brand-structural">
                                {course.title}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                {course.moduleCount}{" "}
                                {course.moduleCount === 1
                                  ? "módulo"
                                  : "módulos"}{" "}
                                · {course.lessonCount}{" "}
                                {course.lessonCount === 1 ? "aula" : "aulas"}
                              </span>
                            </span>
                            <span className="hidden min-w-28 sm:block">
                              <Progress
                                aria-label={`${course.progress.percentage}% do curso concluído`}
                                value={course.progress.percentage}
                              />
                            </span>
                            {completed ? (
                              <CheckCircle2Icon
                                aria-label="Curso concluído"
                                className="size-5 shrink-0 text-brand-action"
                              />
                            ) : (
                              <ArrowRightIcon
                                aria-hidden="true"
                                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand-action"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 border-t pt-8 sm:grid-cols-3">
            {[
              [
                "01",
                "Perguntar",
                "Comece delimitando o que precisa ser compreendido.",
              ],
              [
                "02",
                "Interpretar",
                "Observe o que o estudo mede e o que ele não autoriza dizer.",
              ],
              [
                "03",
                "Aplicar",
                "Leve o raciocínio para o contexto real, sem receita pronta.",
              ],
            ].map(([index, title, description]) => (
              <div
                className="border-brand-action/60 border-l-2 pl-4"
                key={index}
              >
                <span className="font-data text-brand-action text-xs">
                  {index}
                </span>
                <h3 className="mt-3 font-display text-2xl">{title}</h3>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  {description}
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </LearningPageFrame>
  );
};

export default LearnPage;

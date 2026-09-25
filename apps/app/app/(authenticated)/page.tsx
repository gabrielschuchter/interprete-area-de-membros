import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  MessageCircleIcon,
  MessageSquareQuoteIcon,
} from "lucide-react";
import Link from "next/link";
import { getHomeData } from "@/lib/home";
import { requireMemberId } from "@/lib/learning";
import { getOrCreateProfile } from "@/lib/profile";

const firstNamePattern = /\s+/;

const HomePage = async () => {
  const memberId = await requireMemberId();
  const [profile, { courses, activities, meetings, spaces, latestFeedback }] =
    await Promise.all([
      getOrCreateProfile(memberId, false),
      getHomeData(memberId),
    ]);
  const firstName =
    profile?.displayName?.trim().split(firstNamePattern)[0] ?? "estudante";
  const allCourses = courses;
  const inProgressCourse = allCourses.find(
    (course) =>
      course.progress.completedLessons > 0 &&
      course.progress.completedLessons < course.progress.totalLessons
  );
  const nextCourse =
    inProgressCourse ??
    allCourses.find(
      (course) =>
        course.progress.completedLessons < course.progress.totalLessons
    );
  const nextLesson = nextCourse?.modules
    .flatMap((module) => module.lessons)
    .find(
      (lesson) => !lesson.progress.some(({ status }) => status === "COMPLETED")
    );
  const pendingActivity = activities.find(
    (activity) =>
      !activity.submissions[0] || activity.submissions[0].status === "DRAFT"
  );
  const nextMeeting = meetings.upcoming[0];
  const recentPost = spaces.find((space) => space.posts.length > 0)?.posts[0];

  let primaryHref = "/aprender";
  let primaryLabel = "Escolher uma trilha";
  let primaryTitle = "O próximo passo começa com uma pergunta.";
  let primaryDescription =
    "Encontre uma trilha, leia uma aula e avance no seu ritmo.";
  let PrimaryIcon = BookOpenIcon;

  if (pendingActivity) {
    primaryHref = `/atividades/${pendingActivity.slug}`;
    primaryLabel = "Abrir atividade";
    primaryTitle = pendingActivity.title;
    primaryDescription = pendingActivity.prompt;
    PrimaryIcon = CheckCircle2Icon;
  } else if (nextLesson && nextCourse) {
    primaryHref = `/aprender/cursos/${nextCourse.slug}/${nextLesson.slug}`;
    primaryLabel =
      nextCourse.progress.completedLessons > 0
        ? "Continuar aula"
        : "Começar aula";
    primaryTitle = nextLesson.title;
    primaryDescription =
      nextLesson.description ??
      nextCourse.description ??
      "Uma aula para continuar seu percurso.";
    PrimaryIcon = BookOpenIcon;
  } else if (nextMeeting) {
    primaryHref = "/encontros";
    primaryLabel = "Ver próximo encontro";
    primaryTitle = nextMeeting.title;
    primaryDescription = "Uma sala de aula está esperando por você.";
    PrimaryIcon = CalendarDaysIcon;
  } else if (recentPost) {
    const recentSpace = spaces.find((space) =>
      space.posts.some((post) => post.id === recentPost.id)
    );
    primaryHref = `/comunidade/${recentSpace?.slug ?? ""}/${recentPost.id}`;
    primaryLabel = "Ler discussão";
    primaryTitle = recentPost.title;
    primaryDescription =
      "Uma conversa recente pode abrir uma nova linha de pensamento.";
    PrimaryIcon = MessageCircleIcon;
  }

  const totalLessons = allCourses.reduce(
    (sum, course) => sum + course.progress.totalLessons,
    0
  );
  const completedLessons = allCourses.reduce(
    (sum, course) => sum + course.progress.completedLessons,
    0
  );

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Interprete. · seu espaço de estudo</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
            Bom dia, {firstName}.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
            O que merece sua atenção agora?
          </p>
        </header>

        <section
          aria-labelledby="next-step-heading"
          className="paper-surface mt-12 border border-brand-structural/35 p-6 shadow-[var(--shadow-paper)] sm:p-10"
        >
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="brand-eyebrow">Próximo passo</p>
              <h2
                className="mt-4 font-display text-4xl leading-tight sm:text-5xl"
                id="next-step-heading"
              >
                {primaryTitle}
              </h2>
              <p className="mt-4 text-muted-foreground leading-7">
                {primaryDescription}
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={primaryHref}>
                <PrimaryIcon aria-hidden="true" /> {primaryLabel}{" "}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <section
            aria-labelledby="progress-heading"
            className="paper-surface border p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="brand-eyebrow">Seu percurso</p>
                <h2
                  className="mt-2 font-display text-2xl"
                  id="progress-heading"
                >
                  Leitura em andamento
                </h2>
              </div>
              <BookOpenIcon
                aria-hidden="true"
                className="size-5 text-brand-action"
              />
            </div>
            <p className="mt-6 font-data text-3xl text-brand-structural">
              {completedLessons}/{totalLessons || 0}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              aulas concluídas
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm underline underline-offset-4"
              href="/aprender"
            >
              Ver Aprender{" "}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </section>
          <section
            aria-labelledby="activity-heading"
            className="paper-surface border p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="brand-eyebrow">Prática</p>
                <h2
                  className="mt-2 font-display text-2xl"
                  id="activity-heading"
                >
                  Atividades
                </h2>
              </div>
              <CheckCircle2Icon
                aria-hidden="true"
                className="size-5 text-brand-action"
              />
            </div>
            <p className="mt-6 font-display text-2xl">
              {pendingActivity
                ? "Há uma pergunta aberta."
                : "Nenhuma pendência."}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              {activities.length} atividades publicadas
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm underline underline-offset-4"
              href="/atividades"
            >
              Abrir caderno{" "}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </section>
          <section
            aria-labelledby="meeting-heading"
            className="paper-surface border p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="brand-eyebrow">Sala de aula</p>
                <h2 className="mt-2 font-display text-2xl" id="meeting-heading">
                  Encontros
                </h2>
              </div>
              <CalendarDaysIcon
                aria-hidden="true"
                className="size-5 text-brand-action"
              />
            </div>
            {nextMeeting ? (
              <>
                <p className="mt-6 font-display text-2xl">
                  {nextMeeting.title}
                </p>
                <p className="mt-2 text-muted-foreground text-sm">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "medium",
                    timeZone: nextMeeting.timezone,
                  }).format(nextMeeting.startsAt)}
                </p>
              </>
            ) : (
              <p className="mt-6 font-display text-2xl">
                Sem encontro agendado.
              </p>
            )}
            <Link
              className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm underline underline-offset-4"
              href="/encontros"
            >
              Ver agenda{" "}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </section>
        </div>

        {(latestFeedback || recentPost) && (
          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            {latestFeedback && (
              <article className="paper-surface border border-brand-action/35 p-6">
                <div className="flex items-start gap-3">
                  <MessageSquareQuoteIcon
                    aria-hidden="true"
                    className="mt-0.5 size-5 text-brand-action"
                  />
                  <div>
                    <p className="brand-eyebrow">Feedback recente</p>
                    <h2 className="mt-2 font-display text-2xl">
                      {latestFeedback.activity.title}
                    </h2>
                    <p className="mt-2 text-muted-foreground text-sm leading-6">
                      Há uma leitura do professor esperando sua atenção.
                    </p>
                    <Button
                      asChild
                      className="mt-5"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        href={`/atividades/${latestFeedback.activity.slug}`}
                      >
                        Ler feedback <ArrowRightIcon aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            )}
            {recentPost && (
              <article className="paper-surface border p-6">
                <p className="brand-eyebrow">Discussão recente</p>
                <h2 className="mt-2 font-display text-2xl">
                  {recentPost.title}
                </h2>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  Uma conversa recente pode abrir uma nova linha de pensamento.
                </p>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link
                    href={`/comunidade/${spaces.find((space) => space.posts.some((post) => post.id === recentPost.id))?.slug ?? ""}/${recentPost.id}`}
                  >
                    Ler discussão <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
          </section>
        )}

        <section aria-labelledby="orientation-heading" className="mt-14">
          <div className="flex items-center justify-between border-border border-b pb-3">
            <div>
              <p className="brand-eyebrow">Orientação</p>
              <h2
                className="mt-2 font-display text-3xl"
                id="orientation-heading"
              >
                Três movimentos para estudar
              </h2>
            </div>
            <Badge variant="outline">sem atalhos</Badge>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {[
              [
                "01",
                "Perguntar",
                "Comece pela dúvida que você quer tornar mais nítida.",
              ],
              [
                "02",
                "Interpretar",
                "Leia o método, observe o contexto e nomeie as incertezas.",
              ],
              ["03", "Aplicar", "Leve o raciocínio para uma decisão concreta."],
            ].map(([number, title, description]) => (
              <div className="border-border border-t pt-5" key={number}>
                <span className="font-data text-brand-action text-sm">
                  {number}
                </span>
                <h3 className="mt-3 font-display text-2xl">{title}</h3>
                <p className="mt-2 text-muted-foreground leading-6">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;

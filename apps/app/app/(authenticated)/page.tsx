import { HomeBlockType } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  MessageCircleIcon,
  MessageSquareQuoteIcon,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";
import { Stagger } from "@/components/motion/motion";
import { communityPostHref } from "@/lib/community";
import { getHomeData } from "@/lib/home";
import { requireMemberId } from "@/lib/learning";
import { getOrCreateProfile } from "@/lib/profile";

const firstNamePattern = /\s+/;

type HomeData = Awaited<ReturnType<typeof getHomeData>>;

interface HomePrimaryAction {
  readonly description: string;
  readonly href: string;
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly title: string;
}

const getPrimaryAction = ({
  activities,
  courses,
  latestFeedback,
  meetings,
  productConfig,
  recentPost,
  recordings,
  enabledBlocks,
}: Pick<
  HomeData,
  | "activities"
  | "courses"
  | "latestFeedback"
  | "meetings"
  | "productConfig"
  | "recentPost"
  | "recordings"
> & {
  readonly enabledBlocks: ReadonlySet<HomeBlockType>;
}): HomePrimaryAction => {
  const isEnabled = (type: HomeBlockType) => enabledBlocks.has(type);
  const inProgressCourse = courses.find(
    (course) =>
      course.progress.completedLessons > 0 &&
      course.progress.completedLessons < course.progress.totalLessons
  );
  const nextCourse =
    inProgressCourse ??
    courses.find(
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

  if (nextMeeting && isEnabled(HomeBlockType.NEXT_MEETING)) {
    return {
      description:
        nextMeeting.description ?? "Uma sala de aula está esperando por você.",
      href: `/encontros/${nextMeeting.id}`,
      Icon: CalendarDaysIcon,
      label: "Abrir encontro",
      title: nextMeeting.title,
    };
  }

  const recording = recordings.continueWatching[0];
  if (
    recording &&
    productConfig.recordingsExperienceV2 &&
    isEnabled(HomeBlockType.CONTINUE_WATCHING)
  ) {
    return {
      description: `Retome de onde você parou · ${recording.group.legacyStudentName}.`,
      href: `/encontros/gravacoes?asset=${encodeURIComponent(recording.asset.id)}#asset-${recording.asset.id}`,
      Icon: VideoIcon,
      label: "Continuar gravação",
      title: recording.asset.title,
    };
  }

  if (pendingActivity && isEnabled(HomeBlockType.PENDING_ACTIVITY)) {
    return {
      description: pendingActivity.prompt,
      href: `/atividades/${pendingActivity.slug}`,
      Icon: CheckCircle2Icon,
      label: "Abrir atividade",
      title: pendingActivity.title,
    };
  }

  if (latestFeedback && isEnabled(HomeBlockType.FEEDBACK)) {
    return {
      description: "Há uma leitura do professor esperando sua atenção.",
      href: `/atividades/${latestFeedback.activity.slug}`,
      Icon: MessageSquareQuoteIcon,
      label: "Ler feedback",
      title: latestFeedback.activity.title,
    };
  }

  if (
    nextLesson &&
    nextCourse &&
    productConfig.showLearnNavigation &&
    isEnabled(HomeBlockType.ASYNC_LEARNING)
  ) {
    return {
      description:
        nextLesson.description ??
        nextCourse.description ??
        "Uma aula para continuar seu percurso.",
      href: `/aprender/cursos/${nextCourse.slug}/${nextLesson.slug}`,
      Icon: BookOpenIcon,
      label:
        nextCourse.progress.completedLessons > 0
          ? "Continuar aula"
          : "Começar aula",
      title: nextLesson.title,
    };
  }

  if (recentPost && isEnabled(HomeBlockType.COMMUNITY)) {
    return {
      description:
        "Uma conversa recente pode abrir uma nova linha de pensamento.",
      href: communityPostHref(recentPost),
      Icon: MessageCircleIcon,
      label: "Ler discussão",
      title: recentPost.title,
    };
  }

  return {
    description:
      "Quando houver um encontro, preparação ou atividade esperando por você, ela aparecerá aqui.",
    href: "/encontros",
    Icon: CalendarDaysIcon,
    label: "Ver agenda",
    title: "O próximo passo começa com uma pergunta.",
  };
};

const HomePage = async () => {
  const memberId = await requireMemberId();
  const [
    profile,
    {
      courses,
      activities,
      meetings,
      recentPost,
      latestFeedback,
      recordings,
      productConfig,
      homeBlocks,
    },
  ] = await Promise.all([
    getOrCreateProfile(memberId, false),
    getHomeData(memberId),
  ]);
  const firstName =
    profile?.displayName?.trim().split(firstNamePattern)[0] ?? "estudante";
  const enabledBlocks = new Set(
    homeBlocks
      .filter((configuration) => configuration.enabled)
      .map((configuration) => configuration.type)
  );
  const primaryAction = getPrimaryAction({
    activities,
    courses,
    latestFeedback,
    meetings,
    productConfig,
    recentPost,
    recordings,
    enabledBlocks,
  });
  const PrimaryIcon = primaryAction.Icon;
  const isHomeBlockEnabled = (type: HomeBlockType) => enabledBlocks.has(type);
  const nextMeeting = meetings.upcoming[0];
  const pendingActivity = activities.find(
    (activity) =>
      !activity.submissions[0] || activity.submissions[0].status === "DRAFT"
  );
  const allCourses = courses;

  const totalLessons = productConfig.showLearnNavigation
    ? allCourses.reduce((sum, course) => sum + course.progress.totalLessons, 0)
    : 0;
  const completedLessons = productConfig.showLearnNavigation
    ? allCourses.reduce(
        (sum, course) => sum + course.progress.completedLessons,
        0
      )
    : 0;

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
                {primaryAction.title}
              </h2>
              <p className="mt-4 text-muted-foreground leading-7">
                {primaryAction.description}
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={primaryAction.href}>
                <PrimaryIcon aria-hidden="true" /> {primaryAction.label}{" "}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <Stagger className="mt-10 grid gap-5 lg:grid-cols-3">
          {isHomeBlockEnabled(HomeBlockType.ASYNC_LEARNING) &&
            productConfig.showLearnNavigation &&
            totalLessons > 0 && (
              <section
                aria-labelledby="progress-heading"
                className="motion-card paper-surface border p-6"
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
                  {completedLessons}/{totalLessons}
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
            )}
          {productConfig.recordingsExperienceV2 &&
            isHomeBlockEnabled(HomeBlockType.CONTINUE_WATCHING) &&
            recordings.continueWatching[0] && (
              <section
                aria-labelledby="recording-heading"
                className="motion-card paper-surface border p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="brand-eyebrow">Encontros anteriores</p>
                    <h2
                      className="mt-2 font-display text-2xl"
                      id="recording-heading"
                    >
                      Continue assistindo
                    </h2>
                  </div>
                  <VideoIcon
                    aria-hidden="true"
                    className="size-5 text-brand-action"
                  />
                </div>
                <p className="mt-6 font-display text-2xl">
                  {recordings.continueWatching[0].asset.title}
                </p>
                <p className="mt-2 text-muted-foreground text-sm">
                  {recordings.continueWatching[0].group.legacyStudentName}
                </p>
                <Link
                  className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm underline underline-offset-4"
                  href={`/encontros/gravacoes?asset=${encodeURIComponent(recordings.continueWatching[0].asset.id)}#asset-${recordings.continueWatching[0].asset.id}`}
                >
                  Retomar{" "}
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </section>
            )}
          {isHomeBlockEnabled(HomeBlockType.PENDING_ACTIVITY) &&
            activities.length > 0 && (
              <section
                aria-labelledby="activity-heading"
                className="motion-card paper-surface border p-6"
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
                  {pendingActivity ? "Há uma pergunta aberta." : "Tudo em dia."}
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
            )}
          {isHomeBlockEnabled(HomeBlockType.NEXT_MEETING) && nextMeeting && (
            <section
              aria-labelledby="meeting-heading"
              className="motion-card paper-surface border p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="brand-eyebrow">Sala de aula</p>
                  <h2
                    className="mt-2 font-display text-2xl"
                    id="meeting-heading"
                  >
                    Próximo encontro
                  </h2>
                </div>
                <CalendarDaysIcon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
              </div>
              <p className="mt-6 font-display text-2xl">{nextMeeting.title}</p>
              <p className="mt-2 text-muted-foreground text-sm">
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "medium",
                  timeZone: nextMeeting.timezone,
                }).format(nextMeeting.startsAt)}
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-2 font-medium text-brand-structural text-sm underline underline-offset-4"
                href={`/encontros/${nextMeeting.id}`}
              >
                Abrir encontro{" "}
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Link>
            </section>
          )}
        </Stagger>

        {(isHomeBlockEnabled(HomeBlockType.FEEDBACK) && latestFeedback) ||
        (isHomeBlockEnabled(HomeBlockType.COMMUNITY) && recentPost) ? (
          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            {isHomeBlockEnabled(HomeBlockType.FEEDBACK) && latestFeedback && (
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
            {isHomeBlockEnabled(HomeBlockType.COMMUNITY) && recentPost && (
              <article className="paper-surface border p-6">
                <p className="brand-eyebrow">Discussão recente</p>
                <h2 className="mt-2 font-display text-2xl">
                  {recentPost.title}
                </h2>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  Uma conversa recente pode abrir uma nova linha de pensamento.
                </p>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link href={communityPostHref(recentPost)}>
                    Ler discussão <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
          </section>
        ) : null}

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

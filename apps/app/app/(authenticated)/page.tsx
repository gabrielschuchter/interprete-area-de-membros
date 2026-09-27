import { HomeBlockType } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
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
import { communityPostHref } from "@/lib/community";
import {
  collectionItemHref,
  collectionItemLabel,
} from "@/lib/content-collections";
import { getHomeData } from "@/lib/home";
import { requireMemberId } from "@/lib/learning";
import { getOrCreateProfile } from "@/lib/profile";

const whitespacePattern = /\s+/;
const firstName = (displayName: string) =>
  displayName.split(whitespacePattern)[0] ?? displayName;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the Home composition intentionally gates independent editorial blocks without a client-side dashboard state machine.
const HomePage = async () => {
  const memberId = await requireMemberId();
  const [profile, data] = await Promise.all([
    getOrCreateProfile(memberId),
    getHomeData(memberId),
  ]);
  const enabledBlocks = new Set(
    data.homeBlocks.filter((block) => block.enabled).map((block) => block.type)
  );
  const block = (type: HomeBlockType) =>
    data.homeBlocks.find((item) => item.type === type);
  const isEnabled = (type: HomeBlockType) => enabledBlocks.has(type);
  const nextMeeting = data.meetings.upcoming[0];
  const pendingActivity = data.activities.find(
    (activity) =>
      !activity.submissions[0] || activity.submissions[0].status === "DRAFT"
  );
  const inProgressCourse = data.courses.find(
    (course) =>
      course.progress.completedLessons > 0 &&
      course.progress.completedLessons < course.progress.totalLessons
  );
  const nextCourse =
    inProgressCourse ??
    data.courses.find(
      (course) =>
        course.progress.completedLessons < course.progress.totalLessons
    );
  const nextLesson = nextCourse?.modules
    .flatMap((module) => module.lessons)
    .find(
      (lesson) => !lesson.progress.some(({ status }) => status === "COMPLETED")
    );
  const configuredCollection = block(HomeBlockType.COLLECTION)?.collectionId
    ? data.collections.find(
        (collection) =>
          collection.id === block(HomeBlockType.COLLECTION)?.collectionId
      )
    : null;
  const displayName = profile?.displayName ?? "Membro";

  return (
    <main className="mx-auto w-full max-w-[1360px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <header className="max-w-4xl">
        <p className="brand-eyebrow">Interprete. · seu espaço de estudo</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-7 max-w-4xl font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
          O que merece sua atenção agora, {firstName(displayName)}?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-8">
          Encontros, prática e boas perguntas no mesmo lugar — na ordem em que
          fazem sentido para você.
        </p>
      </header>

      {nextMeeting && isEnabled(HomeBlockType.NEXT_MEETING) ? (
        <section className="paper-surface mt-14 border border-brand-structural/35 p-6 shadow-[var(--shadow-paper)] sm:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="brand-eyebrow">
                {block(HomeBlockType.NEXT_MEETING)?.title ?? "Próximo encontro"}
              </p>
              <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
                {nextMeeting.title}
              </h2>
              <p className="mt-4 flex items-start gap-2 font-data text-brand-structural text-sm leading-6">
                <CalendarDaysIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "full",
                  timeStyle: "short",
                  timeZone: nextMeeting.timezone,
                }).format(nextMeeting.startsAt)}
              </p>
              {nextMeeting.description && (
                <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
                  {nextMeeting.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="outline">
                <Link href={`/encontros/${nextMeeting.id}`}>Ver detalhes</Link>
              </Button>
              <Button asChild size="lg">
                <a href={nextMeeting.joinUrl} rel="noreferrer" target="_blank">
                  Entrar no encontro <ArrowRightIcon aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-14 border-y py-8">
          <p className="brand-eyebrow">A sala está em silêncio por enquanto</p>
          <h2 className="mt-3 font-display text-3xl">
            Nenhum próximo encontro foi publicado.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
            Você pode retomar uma gravação, continuar uma atividade ou explorar
            uma discussão enquanto a próxima conversa é preparada.
          </p>
        </section>
      )}

      {nextMeeting &&
      isEnabled(HomeBlockType.PREPARATION) &&
      (nextMeeting.relatedActivity || nextMeeting.relatedLibraryItem) ? (
        <section aria-labelledby="preparation-heading" className="mt-12">
          <div className="border-b pb-4">
            <p className="brand-eyebrow">Antes da conversa</p>
            <h2 className="mt-3 font-display text-3xl" id="preparation-heading">
              {block(HomeBlockType.PREPARATION)?.title ?? "Preparação"}
            </h2>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {nextMeeting.relatedActivity && (
              <article className="paper-surface border p-6">
                <CheckCircle2Icon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
                <p className="brand-eyebrow mt-6">Atividade</p>
                <h3 className="mt-2 font-display text-2xl">
                  {nextMeeting.relatedActivity.title}
                </h3>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link
                    href={`/atividades/${nextMeeting.relatedActivity.slug}`}
                  >
                    Abrir preparação <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
            {nextMeeting.relatedLibraryItem && (
              <article className="paper-surface border p-6">
                <BookOpenIcon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
                <p className="brand-eyebrow mt-6">Leitura</p>
                <h3 className="mt-2 font-display text-2xl">
                  {nextMeeting.relatedLibraryItem.title}
                </h3>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link href="/biblioteca">
                    Abrir biblioteca <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
          </div>
        </section>
      ) : null}

      {isEnabled(HomeBlockType.CONTINUE_WATCHING) &&
        data.recordings.continueWatching.length > 0 && (
          <section aria-labelledby="continue-heading" className="mt-14">
            <div className="flex items-end justify-between border-b pb-4">
              <div>
                <p className="brand-eyebrow">Uma segunda passagem</p>
                <h2
                  className="mt-3 font-display text-3xl"
                  id="continue-heading"
                >
                  {block(HomeBlockType.CONTINUE_WATCHING)?.title ??
                    "Continue assistindo"}
                </h2>
              </div>
              <Link
                className="text-brand-structural text-sm underline underline-offset-4"
                href="/encontros/gravacoes"
              >
                Ver arquivo
              </Link>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.recordings.continueWatching
                .slice(
                  0,
                  block(HomeBlockType.CONTINUE_WATCHING)?.itemCount ?? 3
                )
                .map((recording) => (
                  <article
                    className="paper-surface border p-6"
                    key={recording.asset.id}
                  >
                    <VideoIcon
                      aria-hidden="true"
                      className="size-5 text-brand-action"
                    />
                    <p className="brand-eyebrow mt-6">
                      {recording.group.legacyStudentName}
                    </p>
                    <h3 className="mt-2 font-display text-2xl">
                      {recording.asset.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground text-sm">
                      Você parou em{" "}
                      {Math.round(recording.progress.positionSeconds / 60)} min.
                    </p>
                    <Button
                      asChild
                      className="mt-5"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        href={`/encontros/gravacoes?asset=${recording.asset.id}#asset-${recording.asset.id}`}
                      >
                        Retomar <ArrowRightIcon aria-hidden="true" />
                      </Link>
                    </Button>
                  </article>
                ))}
            </div>
          </section>
        )}

      {(isEnabled(HomeBlockType.PENDING_ACTIVITY) && pendingActivity) ||
      (isEnabled(HomeBlockType.FEEDBACK) && data.latestFeedback) ||
      (isEnabled(HomeBlockType.COMMUNITY) && data.recentPost) ? (
        <section aria-labelledby="attention-heading" className="mt-14">
          <div className="border-b pb-4">
            <p className="brand-eyebrow">Agora</p>
            <h2 className="mt-3 font-display text-3xl" id="attention-heading">
              Para você
            </h2>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {isEnabled(HomeBlockType.PENDING_ACTIVITY) && pendingActivity && (
              <article className="paper-surface border p-6">
                <CheckCircle2Icon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
                <p className="brand-eyebrow mt-6">Prática</p>
                <h3 className="mt-2 font-display text-2xl">
                  {pendingActivity.title}
                </h3>
                <p className="mt-3 text-muted-foreground text-sm leading-6">
                  Uma pergunta aberta esperando sua leitura.
                </p>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link href={`/atividades/${pendingActivity.slug}`}>
                    Abrir atividade <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
            {isEnabled(HomeBlockType.FEEDBACK) && data.latestFeedback && (
              <article className="paper-surface border border-brand-action/35 p-6">
                <MessageSquareQuoteIcon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
                <p className="brand-eyebrow mt-6">Feedback novo</p>
                <h3 className="mt-2 font-display text-2xl">
                  {data.latestFeedback.activity.title}
                </h3>
                <p className="mt-3 text-muted-foreground text-sm leading-6">
                  Há uma leitura do professor esperando sua atenção.
                </p>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link
                    href={`/atividades/${data.latestFeedback.activity.slug}`}
                  >
                    Ler feedback <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
            {isEnabled(HomeBlockType.COMMUNITY) && data.recentPost && (
              <article className="paper-surface border p-6">
                <MessageCircleIcon
                  aria-hidden="true"
                  className="size-5 text-brand-action"
                />
                <p className="brand-eyebrow mt-6">Comunidade</p>
                <h3 className="mt-2 font-display text-2xl">
                  {data.recentPost.title}
                </h3>
                <p className="mt-3 text-muted-foreground text-sm leading-6">
                  Uma conversa recente pode abrir uma nova linha de pensamento.
                </p>
                <Button asChild className="mt-5" size="sm" variant="outline">
                  <Link href={communityPostHref(data.recentPost)}>
                    Ler discussão <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            )}
          </div>
        </section>
      ) : null}

      {data.productConfig.showLearnNavigation &&
        isEnabled(HomeBlockType.ASYNC_LEARNING) &&
        nextCourse &&
        nextLesson && (
          <section
            aria-labelledby="learning-heading"
            className="mt-14 border-t pt-10"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="brand-eyebrow">Aprendizado assíncrono</p>
                <h2
                  className="mt-3 font-display text-3xl"
                  id="learning-heading"
                >
                  {block(HomeBlockType.ASYNC_LEARNING)?.title ??
                    "Continue estudando"}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {nextCourse.progress.completedLessons} de{" "}
                  {nextCourse.progress.totalLessons} aulas concluídas.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link
                  href={`/aprender/cursos/${nextCourse.slug}/${nextLesson.slug}`}
                >
                  Continuar aula <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </section>
        )}

      {configuredCollection && isEnabled(HomeBlockType.COLLECTION) && (
        <section
          aria-labelledby="collection-heading"
          className="mt-14 border-t pt-10"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="brand-eyebrow">Curadoria</p>
              <h2
                className="mt-3 font-display text-3xl"
                id="collection-heading"
              >
                {block(HomeBlockType.COLLECTION)?.title ??
                  configuredCollection.title}
              </h2>
              {block(HomeBlockType.COLLECTION)?.subtitle && (
                <p className="mt-2 text-muted-foreground">
                  {block(HomeBlockType.COLLECTION)?.subtitle}
                </p>
              )}
            </div>
            <Link
              className="text-brand-structural text-sm underline underline-offset-4"
              href={`/colecoes/${configuredCollection.slug}`}
            >
              Ver coleção
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {configuredCollection.items
              .slice(0, block(HomeBlockType.COLLECTION)?.itemCount ?? 4)
              .map((item) => {
                const href = collectionItemHref(item);
                return href ? (
                  <Link
                    className="paper-surface border p-5 transition-colors hover:bg-muted/30"
                    href={href}
                    key={item.id}
                  >
                    <p className="font-display text-xl">
                      {collectionItemLabel(item)}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-brand-structural text-sm">
                      Abrir{" "}
                      <ArrowRightIcon aria-hidden="true" className="size-4" />
                    </span>
                  </Link>
                ) : null;
              })}
          </div>
        </section>
      )}
    </main>
  );
};

export default HomePage;

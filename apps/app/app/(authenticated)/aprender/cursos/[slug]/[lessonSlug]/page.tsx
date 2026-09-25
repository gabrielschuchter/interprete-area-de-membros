import { Badge } from "@repo/design-system/components/ui/badge";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ExternalLinkIcon,
  PaperclipIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteLessonButton } from "@/components/learning/complete-lesson-button";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { LessonPlayer } from "@/components/learning/lesson-player";

const assetKindLabel = (kind: string) => {
  switch (kind) {
    case "PDF":
      return "PDF";
    case "IMAGE":
      return "Imagem";
    default:
      return "Material";
  }
};

import { RichDocument } from "@/components/learning/rich-document";
import { getPublishedLesson, requireMemberId } from "@/lib/learning";

export const dynamic = "force-dynamic";

const resourceKindLabels: Record<string, string> = {
  ARTICLE: "Artigo",
  EXTERNAL_LINK: "Link externo",
  FILE: "Arquivo",
  PDF: "PDF",
  RECOMMENDED_READING: "Leitura recomendada",
};

const safeResourceUrl = (value: string) => {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

interface LessonPageProperties {
  readonly params: Promise<{ lessonSlug: string; slug: string }>;
}

const LessonPage = async ({ params }: LessonPageProperties) => {
  const { lessonSlug, slug } = await params;
  const memberId = await requireMemberId();
  const lesson = await getPublishedLesson(slug, lessonSlug, memberId);

  if (!lesson) {
    notFound();
  }

  const courseSlug = lesson.module.course.slug;
  const modules = lesson.module.course.modules;
  const lessons = modules.flatMap((module) => module.lessons);
  const lessonIndex = lessons.findIndex(({ id }) => id === lesson.id);
  const lessonNumber = lessonIndex >= 0 ? lessonIndex + 1 : 1;

  return (
    <LearningPageFrame
      description={lesson.description ?? undefined}
      eyebrow={`${lesson.module.course.title} · ${lesson.module.title}`}
      title={lesson.title}
    >
      <div className="mb-2 flex flex-wrap items-center gap-3 border-b pb-5">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-brand-structural"
          href={`/aprender/cursos/${courseSlug}`}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Voltar ao curso
        </Link>
        <span aria-hidden="true" className="text-border">
          /
        </span>
        <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
          Aula {String(lessonNumber).padStart(2, "0")} de {lessons.length}
        </span>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(12rem,0.25fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
        <aside className="order-2 lg:sticky lg:top-24 lg:order-1">
          <div className="border-y py-5 lg:border-t-0">
            <p className="brand-eyebrow">Neste curso</p>
            <nav aria-label="Aulas do curso" className="mt-4 space-y-6">
              {modules.map((module, moduleIndex) => (
                <div key={module.slug}>
                  <p className="font-data text-[0.65rem] text-muted-foreground uppercase tracking-[0.14em]">
                    {String(moduleIndex + 1).padStart(2, "0")} · {module.title}
                  </p>
                  <ol className="mt-2 space-y-1">
                    {module.lessons.map((item) => {
                      const isCurrent = item.id === lesson.id;
                      const isCompleted = item.progress.some(
                        ({ status }) => status === "COMPLETED"
                      );

                      return (
                        <li key={item.id}>
                          <Link
                            aria-current={isCurrent ? "page" : undefined}
                            className={`group flex min-h-11 items-start gap-2 border-l-2 px-3 py-2 text-sm leading-5 transition-colors ${
                              isCurrent
                                ? "border-brand-action bg-brand-action/8 text-brand-structural"
                                : "border-transparent text-muted-foreground hover:border-brand-action/40 hover:text-foreground"
                            }`}
                            href={`/aprender/cursos/${courseSlug}/${item.slug}`}
                          >
                            {isCompleted ? (
                              <CheckCircle2Icon
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 text-brand-action"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-60"
                              />
                            )}
                            <span className="line-clamp-2">{item.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <div className="order-1 min-w-0 space-y-8 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{lesson.kind}</Badge>
              <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.12em]">
                {lesson.module.title}
              </span>
            </div>
            {lesson.isCompleted && (
              <span className="inline-flex items-center gap-2 font-data text-brand-action text-xs uppercase tracking-[0.12em]">
                <CheckCircle2Icon aria-hidden="true" className="size-4" />
                Concluída
              </span>
            )}
          </div>

          <article className="paper-surface border shadow-[var(--shadow-paper)]">
            <div className="reading-column mx-auto px-6 py-8 sm:px-12 sm:py-14 lg:px-16 lg:py-16">
              <div className="mb-10 border-b pb-8">
                <p className="brand-eyebrow">Pergunta para levar à leitura</p>
                <p className="mt-4 max-w-xl font-display text-2xl text-brand-structural leading-tight sm:text-3xl">
                  O que esta evidência permite afirmar — e o que ainda precisa
                  ser perguntado?
                </p>
              </div>
              {lesson.content ? (
                <div className="lesson-document">
                  <RichDocument value={lesson.content} />
                </div>
              ) : (
                <div className="border-brand-action/60 border-l-2 pl-5 text-muted-foreground leading-7">
                  O conteúdo desta aula ainda não foi publicado.
                </div>
              )}
            </div>
          </article>

          {lesson.assets.length > 0 && (
            <section className="border-y py-7 sm:py-8">
              <div className="flex items-start gap-3">
                <PaperclipIcon
                  aria-hidden="true"
                  className="mt-1 size-5 text-brand-action"
                />
                <div>
                  <p className="brand-eyebrow">Materiais da aula</p>
                  <h2 className="mt-2 font-display text-2xl">
                    Arquivos e gravações
                  </h2>
                </div>
              </div>
              <div className="mt-6 space-y-6">
                {lesson.assets.map((asset) =>
                  asset.kind === "VIDEO" ? (
                    <div className="space-y-3" key={asset.id}>
                      <LessonPlayer
                        assetId={asset.id}
                        mimeType={asset.mimeType}
                        title={asset.title}
                      />
                      {asset.scope === "INDIVIDUAL" && (
                        <p className="font-data text-brand-action text-xs uppercase tracking-[0.12em]">
                          Gravação protegida da sua aula
                        </p>
                      )}
                    </div>
                  ) : (
                    <a
                      className="group flex min-h-16 items-center gap-4 border-y py-4 transition-colors hover:text-brand-structural"
                      href={`/api/learning/assets/${asset.id}`}
                      key={asset.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-medium">{asset.title}</span>
                        <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.1em]">
                          {assetKindLabel(asset.kind)}
                        </span>
                      </span>
                      <ExternalLinkIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </a>
                  )
                )}
              </div>
            </section>
          )}

          {lesson.resources.length > 0 && (
            <section className="border-y py-7 sm:py-8">
              <div className="flex items-start gap-3">
                <PaperclipIcon
                  aria-hidden="true"
                  className="mt-1 size-5 text-brand-action"
                />
                <div>
                  <p className="brand-eyebrow">Para continuar a investigação</p>
                  <h2 className="mt-2 font-display text-2xl">
                    Leituras e recursos
                  </h2>
                </div>
              </div>
              <ul className="mt-5 divide-y border-y">
                {lesson.resources.map((resource) => {
                  const href = safeResourceUrl(resource.url);

                  return (
                    <li key={resource.id}>
                      {href ? (
                        <a
                          className="group flex min-h-16 items-center gap-4 py-4 transition-colors hover:text-brand-structural"
                          href={href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="font-medium">
                              {resource.title}
                            </span>
                            <span className="font-data text-muted-foreground text-xs uppercase tracking-[0.1em]">
                              {resourceKindLabels[resource.kind] ?? "Recurso"}
                            </span>
                          </span>
                          <ExternalLinkIcon
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          />
                        </a>
                      ) : (
                        <span className="block py-4 text-muted-foreground text-sm">
                          {resource.title} — recurso indisponível
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {lesson.activities.length > 0 && (
            <section className="border-brand-action/50 border-l-2 bg-brand-action/5 px-5 py-6 sm:px-7">
              <div className="flex items-start gap-3">
                <ClipboardCheckIcon
                  aria-hidden="true"
                  className="mt-1 size-5 text-brand-action"
                />
                <div>
                  <p className="brand-eyebrow">Prática relacionada</p>
                  <h2 className="mt-2 font-display text-2xl">
                    Leve esta pergunta para o caderno.
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {lesson.activities.map((activity) => (
                      <li key={activity.id}>
                        <Link
                          className="inline-flex min-h-11 items-center gap-2 text-brand-structural text-sm underline underline-offset-4"
                          href={`/atividades/${activity.slug}`}
                        >
                          {activity.title}
                          <ArrowRightIcon
                            aria-hidden="true"
                            className="size-4"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          <aside className="grid overflow-hidden border-y py-7 sm:grid-cols-[minmax(0,1fr)_14rem] sm:gap-8 sm:py-8">
            <div className="flex flex-col justify-center">
              <p className="brand-eyebrow">Nota de leitura</p>
              <p className="mt-3 max-w-xl font-display text-2xl leading-tight sm:text-3xl">
                Uma pergunta bem colocada também faz parte do método.
              </p>
            </div>
            <figure className="relative mt-5 min-h-40 overflow-hidden border bg-brand-depth/10 sm:mt-0">
              <Image
                alt="Recorte editorial com anotações de leitura."
                className="object-cover"
                fill
                sizes="(min-width: 640px) 14rem, 100vw"
                src="/brand/learning/reading-notes.png"
              />
            </figure>
          </aside>

          <div className="flex flex-col gap-5 border-y py-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              {lesson.previousLesson && (
                <Link
                  className="inline-flex min-h-11 max-w-full items-center gap-2 text-muted-foreground text-sm hover:text-brand-structural"
                  href={`/aprender/cursos/${courseSlug}/${lesson.previousLesson.slug}`}
                >
                  <ArrowLeftIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  <span className="truncate">
                    Anterior: {lesson.previousLesson.title}
                  </span>
                </Link>
              )}
            </div>
            <CompleteLessonButton
              isCompleted={lesson.isCompleted}
              lessonId={lesson.id}
            />
            <div className="flex min-w-0 flex-1 justify-end">
              {lesson.nextLesson && (
                <Link
                  className="inline-flex min-h-11 max-w-full items-center gap-2 text-right text-muted-foreground text-sm hover:text-brand-structural"
                  href={`/aprender/cursos/${courseSlug}/${lesson.nextLesson.slug}`}
                >
                  <span className="truncate">
                    Próxima: {lesson.nextLesson.title}
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </Link>
              )}
            </div>
          </div>

          {lesson.isCompleted && !lesson.nextLesson && (
            <div className="border-brand-action border-l-2 bg-brand-action/5 px-5 py-4 text-muted-foreground text-sm leading-6">
              Você chegou ao fim deste curso. Volte ao índice para reler
              qualquer aula ou explorar outro percurso publicado.
            </div>
          )}
        </div>
      </div>
    </LearningPageFrame>
  );
};

export default LessonPage;

import { randomUUID } from "node:crypto";
import { database, LessonAssetUploadStatus } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createLessonResource,
  removeLessonResource,
} from "@/app/(authenticated)/admin/actions";
import { GestaoLessonEditorForm } from "@/components/gestao/gestao-lesson-editor-form";
import { GestaoLessonPublication } from "@/components/gestao/gestao-lesson-publication";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { gestaoVideoUploadLimit } from "@/lib/gestao-lesson-video-upload";

const GestaoLessonEditorPage = async ({
  params,
}: {
  readonly params: Promise<{ id: string; lessonId: string }>;
}) => {
  const { actor } = await requireGestaoAction("content.manage");
  const { id: courseId, lessonId } = await params;
  const lesson = await database.lesson.findFirst({
    where: {
      id: lessonId,
      module: { courseId },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      objectives: true,
      content: true,
      kind: true,
      status: true,
      updatedAt: true,
      module: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true, slug: true } },
        },
      },
      assets: {
        where: { kind: "VIDEO" },
        orderBy: { position: "asc" },
        take: 1,
        select: {
          id: true,
          title: true,
          mediaProvider: true,
          mediaExternalId: true,
          youtubeSourceUrl: true,
          youtubeVideoTitle: true,
          youtubeThumbnailUrl: true,
          youtubeVerificationStatus: true,
          youtubeCaptionsAvailable: true,
          youtubeStartAtSeconds: true,
          youtubeEndAtSeconds: true,
          externalUrl: true,
          storagePath: true,
          durationSeconds: true,
          updatedAt: true,
        },
      },
      resources: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, kind: true, url: true },
      },
    },
  });

  if (!lesson) {
    notFound();
  }

  const storedAsset = lesson.assets[0] ?? null;
  const pendingUpload = await database.lessonAssetUpload.findFirst({
    where: {
      actorId: actor.userId,
      lessonId,
      status: {
        in: [LessonAssetUploadStatus.PENDING, LessonAssetUploadStatus.READY],
      },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      expectedAssetId: true,
      expectedAssetUpdatedAt: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      expiresAt: true,
    },
  });
  const resumableUpload =
    pendingUpload &&
    pendingUpload.expectedAssetId === (storedAsset?.id ?? null) &&
    pendingUpload.expectedAssetUpdatedAt?.getTime() ===
      (storedAsset?.updatedAt.getTime() ?? undefined)
      ? pendingUpload
      : null;
  const asset = storedAsset
    ? {
        durationSeconds: storedAsset.durationSeconds,
        externalUrl: storedAsset.externalUrl,
        hasStoredAsset: Boolean(storedAsset.storagePath),
        id: storedAsset.id,
        mediaExternalId: storedAsset.mediaExternalId,
        mediaProvider: storedAsset.mediaProvider,
        updatedAt: storedAsset.updatedAt,
        youtubeCaptionsAvailable: storedAsset.youtubeCaptionsAvailable,
        youtubeEndAtSeconds: storedAsset.youtubeEndAtSeconds,
        youtubeSourceUrl: storedAsset.youtubeSourceUrl,
        youtubeStartAtSeconds: storedAsset.youtubeStartAtSeconds,
        youtubeThumbnailUrl: storedAsset.youtubeThumbnailUrl,
        youtubeVerificationStatus: storedAsset.youtubeVerificationStatus,
        youtubeVideoTitle: storedAsset.youtubeVideoTitle,
      }
    : null;
  const published = lesson.status === "PUBLISHED";

  return (
    <main className="gl-lesson-page">
      <nav aria-label="Trilha de navegação" className="gl-lesson-breadcrumbs">
        <Link href="/gestao/ensino/cursos">Ensino</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/gestao/ensino/cursos/${courseId}`}>
          {lesson.module.course.title}
        </Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{lesson.title}</span>
      </nav>

      <header className="gl-lesson-heading">
        <div>
          <p className="gestao-eyebrow">
            {lesson.module.title} · {lesson.module.course.title}
          </p>
          <h1>Editar aula</h1>
        </div>
        <div className="gl-lesson-heading-actions">
          <span
            className={`gl-lesson-status${published ? "is-published" : ""}`}
          >
            {published ? "Publicado" : "Rascunho"}
          </span>
          {published ? (
            <Button asChild variant="outline">
              <Link
                href={`/cursos/${lesson.module.course.slug}/${lesson.slug}`}
              >
                <ExternalLinkIcon aria-hidden="true" />
                Ver como aluno
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="gl-lesson-layout">
        <div className="gl-lesson-primary">
          <GestaoLessonEditorForm
            asset={asset}
            courseId={courseId}
            initialIdempotencyKey={randomUUID()}
            lesson={{
              content: lesson.content as never,
              description: lesson.description,
              id: lesson.id,
              kind: lesson.kind,
              objectives: lesson.objectives,
              slug: lesson.slug,
              title: lesson.title,
              updatedAt: lesson.updatedAt,
            }}
            maxVideoUploadBytes={gestaoVideoUploadLimit()}
            memberId={actor.userId}
            pendingUpload={
              resumableUpload
                ? {
                    expiresAt: resumableUpload.expiresAt.toISOString(),
                    fileName: resumableUpload.originalFileName,
                    id: resumableUpload.id,
                    mimeType: resumableUpload.mimeType,
                    sizeBytes: Number(resumableUpload.sizeBytes),
                    status:
                      resumableUpload.status === LessonAssetUploadStatus.READY
                        ? "READY"
                        : "PENDING",
                  }
                : null
            }
          />

          <section className="gl-lesson-card gl-lesson-materials">
            <header>
              <div>
                <h2>Materiais e atividades associados</h2>
                <p>Recursos já vinculados a esta aula.</p>
              </div>
              <details className="gl-lesson-associate">
                <summary>
                  <PlusIcon aria-hidden="true" /> Associar
                </summary>
                <form action={createLessonResource}>
                  <input name="lessonId" type="hidden" value={lesson.id} />
                  <label htmlFor="gestao-resource-title">
                    Nome do material
                  </label>
                  <input
                    id="gestao-resource-title"
                    maxLength={180}
                    name="title"
                    required
                  />
                  <label htmlFor="gestao-resource-kind">Tipo</label>
                  <select
                    defaultValue="RECOMMENDED_READING"
                    id="gestao-resource-kind"
                    name="kind"
                  >
                    <option value="RECOMMENDED_READING">Leitura</option>
                    <option value="PDF">PDF</option>
                    <option value="ARTICLE">Artigo</option>
                    <option value="EXTERNAL_LINK">Link</option>
                    <option value="FILE">Arquivo</option>
                  </select>
                  <label htmlFor="gestao-resource-url">Endereço</label>
                  <input
                    id="gestao-resource-url"
                    maxLength={2000}
                    name="url"
                    placeholder="https://…"
                    required
                    type="url"
                  />
                  <Button size="sm" type="submit">
                    Associar material
                  </Button>
                </form>
              </details>
            </header>
            {lesson.resources.length > 0 ? (
              <ul>
                {lesson.resources.map((resource) => (
                  <li key={resource.id}>
                    <span>{resource.title}</span>
                    <div>
                      <a
                        aria-label={`Abrir ${resource.title} em nova aba`}
                        href={resource.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLinkIcon aria-hidden="true" />
                      </a>
                      <form action={removeLessonResource}>
                        <input
                          name="resourceId"
                          type="hidden"
                          value={resource.id}
                        />
                        <button
                          aria-label={`Remover ${resource.title}`}
                          type="submit"
                        >
                          <Trash2Icon aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gl-lesson-empty">
                Nenhum material está associado a esta aula.
              </p>
            )}
          </section>
        </div>

        <aside className="gl-lesson-aside">
          <section className="gl-lesson-card gl-lesson-publication">
            <h2>Publicação</h2>
            <div className="gl-lesson-publication-state">
              <span>Estado</span>
              <span className={published ? "is-live" : ""}>
                {published ? "Publicado" : "Rascunho"}
              </span>
            </div>
            <GestaoLessonPublication
              expectedUpdatedAt={lesson.updatedAt.toISOString()}
              initialIdempotencyKey={randomUUID()}
              lessonId={lesson.id}
              published={published}
            />
            <p>
              {published
                ? "A aula está disponível para quem tem acesso ao curso."
                : "A aula só ficará visível depois da publicação."}
            </p>
          </section>

          <section className="gl-lesson-card gl-lesson-audience">
            <h2>Quem vê</h2>
            <p>
              Alunos com acesso liberado ao curso poderão ver esta aula depois
              da publicação.
            </p>
            <Link href={`/gestao/ensino/cursos/${courseId}`}>
              Ver configurações do curso <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default GestaoLessonEditorPage;

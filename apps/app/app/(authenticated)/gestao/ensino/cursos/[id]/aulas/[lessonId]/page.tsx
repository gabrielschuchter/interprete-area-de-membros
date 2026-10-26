import { randomUUID } from "node:crypto";
import { database, LessonAssetUploadStatus } from "@repo/database";
import { ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { GestaoCrumbTail } from "../../../../../gestao-crumbs";
import { GestaoIcon } from "../../../../../gestao-icon";

const relativeFormat = new Intl.RelativeTimeFormat("pt-BR", {
  numeric: "auto",
});

const relativeLabel = (date: Date) => {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) >= 60 * 48) {
    return relativeFormat.format(Math.round(minutes / 1440), "day");
  }
  if (Math.abs(minutes) >= 60) {
    return relativeFormat.format(Math.round(minutes / 60), "hour");
  }
  return Math.abs(minutes) >= 1
    ? relativeFormat.format(minutes, "minute")
    : "agora";
};

const LessonAudience = ({
  cohorts,
  courseId,
  recipients,
}: {
  readonly cohorts: readonly {
    readonly _count: { readonly memberships: number };
    readonly id: string;
    readonly name: string;
  }[];
  readonly courseId: string;
  readonly recipients: number;
}) => (
  <section className="gl-lesson-card gl-lesson-audience">
    <h2>Quem vê</h2>
    {cohorts.length > 0 ? (
      <>
        <ul className="gl-lesson-chips gl-lesson-chips--audience">
          {cohorts.map((cohort) => (
            <li key={cohort.id}>
              <GestaoIcon name="users" size={14} />
              <Link
                href={`/gestao/alunos/turmas/${cohort.id}`}
                prefetch={false}
              >
                {cohort.name} · {cohort._count.memberships}
              </Link>
            </li>
          ))}
        </ul>
        <p>
          <strong>{recipients} destinatários.</strong> Quem entrar nessas turmas
          depois também recebe.
        </p>
      </>
    ) : (
      <p>Nenhuma turma tem este curso liberado ainda.</p>
    )}
    <p>
      A aula segue o curso: quem tem o curso liberado vê a aula, no cronograma
      da turma.
    </p>
    <Link
      className="gk-edit-link"
      href={`/gestao/ensino/cursos/${courseId}/turmas`}
      prefetch={false}
    >
      Adicionar turma ou aluno
    </Link>
  </section>
);

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
      position: true,
      module: {
        select: {
          id: true,
          title: true,
          position: true,
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

  const [cohortAccesses, lessonNumber] = await Promise.all([
    database.cohortCourseAccess.findMany({
      where: { courseId, revokedAt: null, cohort: { archivedAt: null } },
      orderBy: { createdAt: "asc" },
      select: {
        cohort: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { memberships: { where: { status: "ACTIVE" } } },
            },
          },
        },
      },
    }),
    database.lesson.count({
      where: {
        module: { courseId },
        OR: [
          { module: { position: { lt: lesson.module.position } } },
          { moduleId: lesson.module.id, position: { lt: lesson.position } },
        ],
      },
    }),
  ]);
  const recipients = cohortAccesses.reduce(
    (total, access) => total + access.cohort._count.memberships,
    0
  );
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

  const savedLabel = relativeLabel(lesson.updatedAt);
  const publication = (variant: "block" | "inline") => (
    <GestaoLessonPublication
      expectedUpdatedAt={lesson.updatedAt.toISOString()}
      initialIdempotencyKey={randomUUID()}
      lessonId={lesson.id}
      published={published}
      variant={variant}
    />
  );

  return (
    <>
      <GestaoCrumbTail
        items={[
          {
            label: lesson.module.course.title,
            href: `/gestao/ensino/cursos/${courseId}`,
          },
          { label: `Aula ${lessonNumber + 1}` },
        ]}
      />
      <header className="gt-detail-heading gl-lesson-head">
        <div>
          <div className="gt-detail-title">
            <h1>Editar aula</h1>
          </div>
          <p>
            Módulo {lesson.module.position + 1} · {lesson.module.title}
          </p>
        </div>
        <div className="gt-detail-actions">
          <span className="gk-course-saved">Salvo {savedLabel}</span>
          <Link
            className="gk-btn"
            href={`/gestao/ensino/cursos/${courseId}/preview`}
            prefetch={false}
          >
            Pré-visualizar como aluno
          </Link>
          {published ? null : publication("inline")}
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
              <h2>Materiais e atividades associados</h2>
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
                  <button
                    className="gk-btn gk-btn--primary gk-btn--sm"
                    type="submit"
                  >
                    Associar material
                  </button>
                </form>
              </details>
            </header>
            {lesson.resources.length > 0 ? (
              <ul className="gl-lesson-chips">
                {lesson.resources.map((resource) => (
                  <li key={resource.id}>
                    <GestaoIcon name="bookmark" size={14} />
                    <a href={resource.url} rel="noreferrer" target="_blank">
                      {resource.title}
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
              <span
                className="gk-chip"
                data-tone={published ? "active" : "neutral"}
              >
                <GestaoIcon
                  name={published ? "check-circle" : "pencil"}
                  size={12}
                />
                {published ? "Publicado" : "Rascunho"}
              </span>
            </div>
            <div className="gl-lesson-publication-actions">
              {published ? null : publication("block")}
              <button
                className="gk-btn"
                form="gestao-lesson-form"
                type="submit"
              >
                {published ? "Salvar alterações" : "Salvar rascunho"}
              </button>
              {published ? publication("block") : null}
            </div>
            <p>
              {published
                ? "A aula está visível para quem tem acesso ao curso."
                : "Nada aparece para os alunos antes de você publicar."}
            </p>
          </section>

          <LessonAudience
            cohorts={cohortAccesses.map(({ cohort }) => cohort)}
            courseId={courseId}
            recipients={recipients}
          />
        </aside>
      </div>
    </>
  );
};

export default GestaoLessonEditorPage;

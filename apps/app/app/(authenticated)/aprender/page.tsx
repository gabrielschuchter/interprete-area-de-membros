import { tracePerformance } from "@repo/observability/performance";
import {
  LearningContentRail,
  type LearningRailCard,
} from "@/components/learning/learning-content-rail";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import {
  collectionItemHref,
  collectionItemLabel,
  getPublishedCollectionsForMember,
} from "@/lib/content-collections";
import {
  getMemberCourseProgress,
  getPublishedLearningPaths,
  requireMemberId,
} from "@/lib/learning";
import { getReceivedLearningAssignments } from "@/lib/learning-assignments";
import { getMemberLearningBookmarkKeys } from "@/lib/library";
import { getMemberContinueWatching } from "@/lib/recordings";

export const dynamic = "force-dynamic";

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : null;

const assignmentState = {
  NEW: "Novo",
  VIEWED: "Visto",
  STARTED: "Em andamento",
  COMPLETED: "Concluído",
  REVOKED: "Revogado",
} as const;

const assignmentTargetLabel: Record<string, string> = {
  ACTIVITY: "Atividade",
  COURSE: "Curso",
  MODULE: "Módulo",
  LESSON: "Aula",
  ASSET: "Material de aula",
  RECORDING: "Gravação",
  LIBRARY_ITEM: "Biblioteca",
  EXERCISE_LIST: "Exercícios",
};

const assignmentActionLabel = (status: string) => {
  if (status === "COMPLETED") {
    return "Revisar";
  }
  if (status === "STARTED") {
    return "Continuar";
  }
  return "Começar";
};

type LearningCollection = Awaited<
  ReturnType<typeof getPublishedCollectionsForMember>
>[number];
type LearningCollectionItem = LearningCollection["items"][number];
interface LearningCourseProgress {
  readonly completedLessons: number;
  readonly percentage: number;
  readonly totalLessons: number;
}

const collectionBookmarkTarget = (item: LearningCollectionItem) => {
  if (item.course) {
    return { targetId: item.course.id, targetType: "COURSE" as const };
  }
  if (item.lesson) {
    return { targetId: item.lesson.id, targetType: "LESSON" as const };
  }
  const assetId = item.recording?.asset.id ?? item.asset?.id;
  if (assetId) {
    return { targetId: assetId, targetType: "ASSET" as const };
  }
  if (item.libraryItem) {
    return {
      targetId: item.libraryItem.id,
      targetType: "LIBRARY_ITEM" as const,
    };
  }
  return undefined;
};

const toCollectionCard = (
  collection: LearningCollection,
  item: LearningCollectionItem,
  bookmarkKeys: ReadonlySet<string>,
  courseProgressById: ReadonlyMap<string, LearningCourseProgress>
): LearningRailCard | null => {
  const href = collectionItemHref(item);
  if (!href) {
    return null;
  }
  const recording = item.recording ?? item.asset?.importedRecording ?? null;
  const recordingThumbnail = recording?.thumbnailPath
    ? `/api/learning/recordings/${recording.id}/thumbnail`
    : null;
  let label = "Biblioteca";
  if (item.lesson) {
    label = "Aula";
  } else if (item.course) {
    label = "Curso";
  } else if (item.exerciseList) {
    label = "Exercícios";
  } else if (recording) {
    label = "Gravação";
  }
  const meta =
    item.lesson?.module.course.title ??
    item.exerciseList?.bank.title ??
    (recording
      ? (formatDate(recording.meetingDate) ?? "Gravação preservada")
      : (item.libraryItem?.kind ?? null));
  const bookmark = collectionBookmarkTarget(item);
  const courseProgress = item.course
    ? courseProgressById.get(item.course.id)
    : undefined;
  const showCourseProgress = Boolean(
    courseProgress && courseProgress.totalLessons > 0
  );

  return {
    bookmark: bookmark
      ? {
          ...bookmark,
          saved: bookmarkKeys.has(
            `${bookmark.targetType}:${bookmark.targetId}`
          ),
        }
      : undefined,
    coverUrl:
      item.lesson?.module.course.coverUrl ??
      item.course?.coverUrl ??
      item.exerciseList?.coverUrl ??
      recordingThumbnail ??
      collection.coverUrl,
    description:
      item.lesson?.description ??
      item.course?.description ??
      item.exerciseList?.description ??
      item.libraryItem?.description ??
      collection.description,
    href,
    label,
    meta: showCourseProgress
      ? `${courseProgress?.completedLessons}/${courseProgress?.totalLessons} aulas · ${courseProgress?.percentage}%`
      : meta,
    progress: showCourseProgress ? courseProgress?.percentage : undefined,
    title: collectionItemLabel(item),
  };
};

const LearnPage = async () => {
  const memberId = await requireMemberId();
  const [learningData, assignments, continueData, bookmarkKeys] =
    await tracePerformance("member.route.learn.primary-data", () => {
      const pathsPromise = getPublishedLearningPaths(memberId);
      const collectionsPromise = getPublishedCollectionsForMember(memberId);
      const learningDataPromise = Promise.all([
        pathsPromise,
        collectionsPromise,
      ]).then(async ([paths, collections]) => {
        const courseProgressById = new Map(
          paths.flatMap((path) =>
            path.courses.map((course) => [course.id, course.progress] as const)
          )
        );
        const collectionCourseIds = [
          ...new Set(
            collections.flatMap((collection) =>
              collection.items.flatMap((item) =>
                item.course ? [item.course.id] : []
              )
            )
          ),
        ];
        const missingCourseIds = collectionCourseIds.filter(
          (courseId) => !courseProgressById.has(courseId)
        );
        const additionalCourseProgress = await tracePerformance(
          "member.route.learn.additional-progress",
          () => getMemberCourseProgress(memberId, missingCourseIds)
        );
        for (const [courseId, progress] of additionalCourseProgress) {
          courseProgressById.set(courseId, progress);
        }
        return { collections, courseProgressById, paths };
      });

      return Promise.all([
        learningDataPromise,
        getReceivedLearningAssignments(memberId),
        getMemberContinueWatching(memberId),
        getMemberLearningBookmarkKeys(memberId),
      ]);
    });
  const { collections, courseProgressById, paths } = learningData;

  const assignmentCards = assignments.map((assignment) => {
    const isScheduled = Boolean(
      assignment.availableAt && assignment.availableAt.getTime() > Date.now()
    );
    const availability = assignment.availableAt
      ? `Disponível em ${formatDate(assignment.availableAt)}`
      : null;
    const due = assignment.dueAt
      ? `Prazo ${formatDate(assignment.dueAt)}`
      : null;
    return {
      actionLabel: isScheduled
        ? "Aguarde a liberação"
        : assignmentActionLabel(assignment.status),
      description: assignment.message,
      disabled: isScheduled,
      bookmark:
        !isScheduled &&
        ["COURSE", "MODULE", "LESSON", "ASSET", "LIBRARY_ITEM"].includes(
          assignment.target.type
        )
          ? {
              targetId: assignment.target.id,
              targetType: assignment.target.type as
                | "COURSE"
                | "MODULE"
                | "LESSON"
                | "ASSET"
                | "LIBRARY_ITEM",
              saved: bookmarkKeys.has(
                `${assignment.target.type}:${assignment.target.id}`
              ),
            }
          : undefined,
      href: `/aprender/atribuicoes/${assignment.id}`,
      label: assignmentState[assignment.status],
      meta:
        [availability, due].filter(Boolean).join(" · ") ||
        (assignmentTargetLabel[assignment.target.type] ?? "Conteúdo"),
      title: assignment.target.title,
    };
  });

  const resumeCards = continueData.continueWatching.map((recording) => ({
    bookmark: {
      targetId: recording.asset.id,
      targetType: "ASSET" as const,
      saved: bookmarkKeys.has(`ASSET:${recording.asset.id}`),
    },
    coverUrl: recording.thumbnailUrl,
    description: recording.legacyLesson.title,
    href: `/encontros/gravacoes?asset=${encodeURIComponent(recording.asset.id)}`,
    label: "Gravação",
    meta: `${recording.group.courseTitle} · ${recording.group.moduleTitle}`,
    progress:
      recording.progress.durationSeconds &&
      recording.progress.durationSeconds > 0
        ? Math.round(
            (recording.progress.positionSeconds /
              recording.progress.durationSeconds) *
              100
          )
        : null,
    title: recording.asset.title,
  }));

  const pathRails = paths.map((path) => ({
    cards: path.courses.map((course) => ({
      bookmark: {
        targetId: course.id,
        targetType: "COURSE" as const,
        saved: bookmarkKeys.has(`COURSE:${course.id}`),
      },
      coverUrl: course.coverUrl ?? path.coverUrl,
      description: course.description ?? path.description,
      href: `/aprender/cursos/${course.slug}`,
      label: "Trilha",
      meta: `${course.progress.completedLessons}/${course.progress.totalLessons} aulas · ${course.progress.percentage}%`,
      progress: course.progress.percentage,
      title: course.title,
    })),
    description: path.description,
    headingId: `learning-path-${path.id}`,
    title: path.title,
  }));

  const collectionRails = collections.map((collection) => ({
    cards: collection.items.flatMap((item) => {
      const card = toCollectionCard(
        collection,
        item,
        bookmarkKeys,
        courseProgressById
      );
      return card ? [card] : [];
    }),
    description: collection.description,
    headingId: `collection-${collection.id}`,
    title: collection.title,
  }));

  const hasContent =
    assignmentCards.length > 0 ||
    resumeCards.length > 0 ||
    pathRails.some((rail) => rail.cards.length > 0) ||
    collectionRails.some((rail) => rail.cards.length > 0);

  return (
    <LearningPageFrame
      description="Aulas, gravações e materiais organizados para você continuar de onde parou."
      eyebrow="Sua área de aprendizagem"
      title="Aprender"
    >
      <div
        className="space-y-10 sm:space-y-12"
        data-route-content-ready="learn"
      >
        <LearningContentRail
          cards={assignmentCards}
          description="Conteúdos enviados pela equipe, com prazos e andamento acompanhados na sua conta."
          headingId="assigned-learning-title"
          title="Enviados para você"
        />
        <LearningContentRail
          cards={resumeCards}
          description="Retome uma aula ou encontro a partir do ponto salvo."
          headingId="resume-learning-title"
          title="Continue assistindo"
        />
        {pathRails.map((rail) => (
          <LearningContentRail key={rail.headingId} {...rail} />
        ))}
        {collectionRails.map((rail) => (
          <LearningContentRail key={rail.headingId} {...rail} />
        ))}
        {!hasContent && (
          <section
            aria-labelledby="learning-empty-title"
            className="border-y py-12"
          >
            <p className="brand-eyebrow">O próximo capítulo será seu</p>
            <h2
              className="mt-3 max-w-2xl font-display text-3xl leading-tight sm:text-4xl"
              id="learning-empty-title"
            >
              Ainda não há conteúdo liberado para esta conta.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
              Quando uma trilha for publicada ou um professor enviar uma aula,
              ela aparecerá aqui automaticamente.
            </p>
          </section>
        )}
      </div>
    </LearningPageFrame>
  );
};

export default LearnPage;

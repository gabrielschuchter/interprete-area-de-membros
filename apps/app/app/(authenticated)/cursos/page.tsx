import { tracePerformance } from "@repo/observability/performance";
import "./cursos.css";
import { CursosView } from "@/components/learning/cursos/cursos-view";
import { LearningCatalog } from "@/components/learning/learning-catalog";
import type { LearningRailCard } from "@/components/learning/learning-content-rail";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { env } from "@/env";
import { requireOnboardedMemberId } from "@/lib/authorization";
import {
  collectionItemHref,
  collectionItemLabel,
  getPublishedCollectionsForMember,
} from "@/lib/content-collections";
import { getCursosResume } from "@/lib/cursos-resume";
import {
  getMemberCourseProgress,
  getPublishedLearningPaths,
  getPublishedStandaloneCourses,
} from "@/lib/learning";
import { getMemberLearningBookmarkKeys } from "@/lib/library";
import { getMemberContinueWatching } from "@/lib/recordings";

export const dynamic = "force-dynamic";

const cursosV2Enabled = () => env.ROOM_V2_ENABLED === "true";

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : null;

type LearningCollection = Awaited<
  ReturnType<typeof getPublishedCollectionsForMember>
>[number];
type LearningCollectionItem = LearningCollection["items"][number];
interface LearningCourseProgress {
  readonly completedLessons: number;
  readonly percentage: number;
  readonly totalLessons: number;
}

const collectionRecording = (item: LearningCollectionItem) =>
  item.recording ?? item.asset?.importedRecording ?? null;

// Cursos só mostra cursos e aulas gravadas: exercícios, materiais e itens de
// biblioteca de uma coleção pertencem a outras seções do Estudar.
const isCursosItem = (item: LearningCollectionItem) =>
  Boolean(item.course ?? item.lesson ?? collectionRecording(item));

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
  return undefined;
};

const toCollectionCard = (
  collection: LearningCollection,
  item: LearningCollectionItem,
  bookmarkKeys: ReadonlySet<string>,
  courseProgressById: ReadonlyMap<string, LearningCourseProgress>
): LearningRailCard | null => {
  const href = collectionItemHref(item);
  if (!(href && isCursosItem(item))) {
    return null;
  }
  const recording = collectionRecording(item);
  const recordingThumbnail = recording?.thumbnailPath
    ? `/api/learning/recordings/${recording.id}/thumbnail`
    : null;
  let label = "Gravação";
  if (item.lesson) {
    label = "Aula";
  } else if (item.course) {
    label = "Curso";
  }
  const meta =
    item.lesson?.module.course.title ??
    (recording
      ? (formatDate(recording.meetingDate) ?? "Gravação preservada")
      : null);
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
      recordingThumbnail ??
      collection.coverUrl,
    description:
      item.lesson?.description ??
      item.course?.description ??
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

const EmptyState = () => (
  <section aria-labelledby="learning-empty-title" className="border-y py-12">
    <p className="brand-eyebrow">O próximo capítulo será seu</p>
    <h2
      className="mt-3 max-w-2xl font-display text-3xl leading-tight sm:text-4xl"
      id="learning-empty-title"
    >
      Ainda não há conteúdo liberado para esta conta.
    </h2>
    <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
      Quando uma trilha ou curso for liberado ou um professor enviar conteúdo,
      ele aparecerá aqui automaticamente.
    </p>
  </section>
);

const LearnPage = async () => {
  const memberId = await requireOnboardedMemberId();
  const [learningData, continueData, bookmarkKeys, resume] =
    await tracePerformance("member.route.learn.primary-data", () => {
      const pathsPromise = getPublishedLearningPaths(memberId);
      const standaloneCoursesPromise = getPublishedStandaloneCourses(memberId);
      const collectionsPromise = getPublishedCollectionsForMember(memberId);
      const learningDataPromise = Promise.all([
        pathsPromise,
        collectionsPromise,
        standaloneCoursesPromise,
      ]).then(async ([paths, collections, standaloneCourses]) => {
        const courseProgressById = new Map(
          [...paths.flatMap((path) => path.courses), ...standaloneCourses].map(
            (course) => [course.id, course.progress] as const
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
        return { collections, courseProgressById, paths, standaloneCourses };
      });

      return Promise.all([
        learningDataPromise,
        getMemberContinueWatching(memberId),
        getMemberLearningBookmarkKeys(memberId),
        cursosV2Enabled() ? getCursosResume(memberId) : Promise.resolve(null),
      ]);
    });
  const { collections, courseProgressById, paths, standaloneCourses } =
    learningData;
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

  const pathRails = paths
    .map((path) => ({
      cards: path.courses.map((course) => ({
        bookmark: {
          targetId: course.id,
          targetType: "COURSE" as const,
          saved: bookmarkKeys.has(`COURSE:${course.id}`),
        },
        coverUrl: course.coverUrl ?? path.coverUrl,
        description: course.description ?? path.description,
        href:
          course.progress.percentage > 0 && course.progress.percentage < 100
            ? `/cursos/${course.slug}/${course.modules.flatMap((module) => module.lessons).find((lesson) => !lesson.progress.some((progress) => progress.status === "COMPLETED"))?.slug ?? ""}`
            : `/cursos/${course.slug}`,
        label: "Curso",
        meta: `${course.progress.completedLessons}/${course.progress.totalLessons} aulas · ${course.progress.percentage}%`,
        progress: course.progress.percentage,
        title: course.title,
      })),
      description: path.description,
      headingId: `learning-path-${path.id}`,
      title: path.title,
    }))
    .filter((rail) => rail.cards.length > 0);
  const standaloneCourseCards = standaloneCourses.map((course) => {
    const lessons = course.modules.flatMap((module) => module.lessons);
    const nextLesson = lessons.find(
      (lesson) => !lesson.progress.some(({ status }) => status === "COMPLETED")
    );

    return {
      bookmark: {
        targetId: course.id,
        targetType: "COURSE" as const,
        saved: bookmarkKeys.has(`COURSE:${course.id}`),
      },
      coverUrl: course.coverUrl,
      description: course.description,
      href:
        course.progress.percentage > 0 && course.progress.percentage < 100
          ? `/cursos/${course.slug}/${nextLesson?.slug ?? ""}`
          : `/cursos/${course.slug}`,
      label: "Curso",
      meta: `${course.progress.completedLessons}/${course.progress.totalLessons} aulas · ${course.progress.percentage}%`,
      progress: course.progress.percentage,
      title: course.title,
    };
  });
  const courseCards = [
    ...pathRails.flatMap((rail) => rail.cards),
    ...standaloneCourseCards,
  ];

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
    resumeCards.length > 0 ||
    courseCards.length > 0 ||
    collectionRails.some((rail) => rail.cards.length > 0);

  if (cursosV2Enabled()) {
    const courseFacts = new Map(
      [...paths.flatMap((path) => path.courses), ...standaloneCourses].map(
        (course) =>
          [
            course.id,
            {
              completedLessons: course.progress.completedLessons,
              lessonCount: course.progress.totalLessons,
              moduleCount: course.modules.length,
            },
          ] as const
      )
    );
    const trails = pathRails.map((rail) => ({
      courseIds: rail.cards.map((card) => card.bookmark.targetId),
      description: rail.description,
      id: rail.headingId,
      title: rail.title,
    }));
    const trailByCourse = new Map(
      trails.flatMap((trail) =>
        trail.courseIds.map((courseId) => [courseId, trail.id] as const)
      )
    );
    const [resumeRecording, ...otherRecordings] = resumeCards;
    return (
      <div className="flex min-h-svh flex-1 flex-col bg-background">
        <main className="flex flex-1 flex-col">
          <CursosView
            courses={courseCards.map((card) => ({
              ...card,
              completedLessons:
                courseFacts.get(card.bookmark.targetId)?.completedLessons ?? 0,
              id: card.bookmark.targetId,
              lessonCount:
                courseFacts.get(card.bookmark.targetId)?.lessonCount ?? 0,
              moduleCount:
                courseFacts.get(card.bookmark.targetId)?.moduleCount ?? 0,
              trailId: trailByCourse.get(card.bookmark.targetId) ?? null,
            }))}
            rails={[
              {
                cards: otherRecordings,
                headingId: "resume-learning-title",
                title: "Continue assistindo",
              },
              ...collectionRails,
            ]}
            resume={
              resume
                ? {
                    ...resume,
                    courseHref: `/cursos/${encodeURIComponent(resume.courseSlug)}`,
                    durationSeconds: resume.lessonDurationSeconds,
                  }
                : null
            }
            resumeRecording={resumeRecording ?? null}
            trails={trails}
          />
          {!hasContent && (
            <div className="mx-auto w-full max-w-[1192px] px-10 pb-16">
              <EmptyState />
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <LearningPageFrame
      description="Seus cursos e aulas gravadas."
      eyebrow="Estudar · Cursos"
      title="Cursos"
      variant="catalog"
    >
      <div
        className="space-y-10 sm:space-y-12"
        data-route-content-ready="learn"
      >
        <LearningCatalog
          cards={resumeCards}
          headingId="resume-learning-title"
          title="Continue assistindo"
        />
        <LearningCatalog
          cards={courseCards.filter(
            (card) => card.progress > 0 && card.progress < 100
          )}
          headingId="learning-in-progress"
          title="Em andamento"
        />
        <LearningCatalog
          cards={courseCards.filter((card) => card.progress === 0)}
          headingId="learning-available"
          title="Disponíveis"
        />
        <LearningCatalog
          cards={courseCards.filter((card) => card.progress === 100)}
          headingId="learning-completed"
          title="Concluídos"
        />
        {collectionRails.map((rail) => (
          <LearningCatalog key={rail.headingId} {...rail} />
        ))}
        {!hasContent && <EmptyState />}
      </div>
    </LearningPageFrame>
  );
};

export default LearnPage;

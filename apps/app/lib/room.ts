import "server-only";

import {
  ContentStatus,
  CourseExperience,
  database,
  LessonAssetKind,
  LessonAssetScope,
  ProgressStatus,
  StudyActivityKind,
} from "@repo/database";
import { getLearningAccessScope, hasLessonAccess } from "./content-access";
import { getPublishedLesson } from "./learning";
import { classifyRoomLessonAccess, roomLessonUnlockDate } from "./room-access";
import { buildRoomOutline, type RoomOutline } from "./room-outline";
import {
  type InitialPlayerState,
  parseStartAt,
  type RoomVideo,
  resolveInitialPlayerState,
  videoAssetAvailability,
} from "./room-player-state";

const published = { status: ContentStatus.PUBLISHED } as const;
const publishedCourse = {
  ...published,
  experience: CourseExperience.ASYNC,
  OR: [{ learningPathId: null }, { learningPath: { is: published } }],
};

export const videoAssetSelect = {
  id: true,
  title: true,
  kind: true,
  scope: true,
  mediaProvider: true,
  mediaExternalId: true,
  storagePath: true,
  externalUrl: true,
  mimeType: true,
  durationSeconds: true,
  youtubeVerificationStatus: true,
  youtubeStartAtSeconds: true,
  youtubeEndAtSeconds: true,
} as const;

export const roomLessonHref = (courseSlug: string, lessonSlug: string) =>
  `/cursos/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonSlug)}`;

export interface RoomMaterial {
  readonly external: boolean;
  readonly href: string | null;
  readonly id: string;
  readonly kind: "file" | "link" | "activity";
  readonly label: string;
  readonly title: string;
}

export interface RoomVideoAsset extends RoomVideo {
  readonly id: string;
  readonly mediaExternalId: string | null;
  readonly mediaProvider: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
  readonly mimeType: string | null;
  readonly title: string;
}

export interface RoomLessonData {
  readonly back: { readonly href: string; readonly label: string };
  readonly completed: boolean;
  readonly content: unknown;
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  readonly description: string | null;
  readonly id: string;
  readonly initialPlayerState: InitialPlayerState;
  readonly kind: "lesson" | "recording";
  // Lesson that notes, the timer and study sessions link to. For recordings
  // it is the lesson that backs the imported recording.
  readonly linkId: string;
  readonly locked: boolean;
  readonly materials: readonly RoomMaterial[];
  readonly module: { readonly id: string; readonly title: string };
  readonly outline: RoomOutline;
  readonly position: {
    readonly durationSeconds: number | null;
    readonly positionSeconds: number;
  };
  readonly releasesAt: Date | null;
  readonly slug: string;
  readonly startAtSeconds: number | null;
  // Replaces the course and module line when set (recordings).
  readonly subtitle: string | null;
  readonly title: string;
  readonly video: RoomVideoAsset | null;
}

export type RoomLessonResult =
  | { readonly status: "not_found" }
  | { readonly status: "forbidden" }
  | { readonly status: "ready"; readonly room: RoomLessonData };

const assetKindLabel: Partial<Record<LessonAssetKind, string>> = {
  AUDIO: "Áudio",
  FILE: "Arquivo",
  IMAGE: "Imagem",
  PDF: "PDF",
  VIDEO: "Vídeo",
};

const resourceKindLabels: Record<string, string> = {
  ARTICLE: "Artigo",
  EXTERNAL_LINK: "Link",
  FILE: "Arquivo",
  PDF: "PDF",
  RECOMMENDED_READING: "Leitura",
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

export const toRoomVideo = (
  asset: {
    readonly durationSeconds: number | null;
    readonly externalUrl: string | null;
    readonly id: string;
    readonly mediaExternalId: string | null;
    readonly mediaProvider: "STORAGE" | "YOUTUBE" | "EXTERNAL_URL";
    readonly mimeType: string | null;
    readonly storagePath: string | null;
    readonly title: string;
    readonly youtubeEndAtSeconds: number | null;
    readonly youtubeStartAtSeconds: number | null;
    readonly youtubeVerificationStatus: string | null;
  } | null
): RoomVideoAsset | null =>
  asset
    ? {
        availability: videoAssetAvailability(asset),
        durationSeconds: asset.durationSeconds,
        endSeconds:
          asset.mediaProvider === "YOUTUBE" ? asset.youtubeEndAtSeconds : null,
        id: asset.id,
        mediaExternalId: asset.mediaExternalId,
        mediaProvider: asset.mediaProvider,
        mimeType: asset.mimeType,
        startSeconds:
          asset.mediaProvider === "YOUTUBE"
            ? asset.youtubeStartAtSeconds
            : null,
        title: asset.title,
      }
    : null;

// One query for the whole lessons panel: modules, lessons, the first video of
// each lesson and this member's completion and playback position.
const getRoomCourseOutline = async (
  courseId: string,
  memberId: string,
  scope: Awaited<ReturnType<typeof getLearningAccessScope>>,
  currentLessonId: string,
  now: Date
) => {
  const course = await database.course.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      slug: true,
      modules: {
        where: published,
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          lessons: {
            where: published,
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: {
              id: true,
              slug: true,
              title: true,
              progress: {
                where: { memberId },
                select: { status: true },
              },
              assets: {
                where: {
                  kind: LessonAssetKind.VIDEO,
                  scope: LessonAssetScope.GENERAL,
                },
                orderBy: [{ position: "asc" }, { title: "asc" }],
                take: 1,
                select: {
                  ...videoAssetSelect,
                  playbackProgress: {
                    where: { memberId },
                    select: { positionSeconds: true, durationSeconds: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const modules = course.modules
    .map((module) => ({
      id: module.id,
      title: module.title,
      lessons: module.lessons
        .filter(
          (lesson) =>
            classifyRoomLessonAccess(scope, {
              courseId,
              lessonId: lesson.id,
              moduleId: module.id,
            }) !== "forbidden"
        )
        .map((lesson) => {
          const asset = lesson.assets[0] ?? null;
          const playback = asset?.playbackProgress[0] ?? null;
          const locked = !hasLessonAccess(
            scope,
            courseId,
            module.id,
            lesson.id
          );
          return {
            completed: lesson.progress.some(
              ({ status }) => status === ProgressStatus.COMPLETED
            ),
            durationSeconds:
              asset?.durationSeconds ?? playback?.durationSeconds ?? null,
            href: roomLessonHref(course.slug, lesson.slug),
            id: lesson.id,
            positionSeconds: playback?.positionSeconds ?? 0,
            releasesAt: locked
              ? (roomLessonUnlockDate(scope, lesson.id) ?? now)
              : null,
            title: lesson.title,
            videoAvailability: asset ? videoAssetAvailability(asset) : null,
          };
        }),
    }))
    .filter((module) => module.lessons.length > 0);

  return {
    lessons: modules.flatMap((module) => module.lessons),
    outline: buildRoomOutline({ currentLessonId, modules, now }),
  };
};

const lessonMaterials = (
  lesson: NonNullable<Awaited<ReturnType<typeof getPublishedLesson>>>,
  primaryVideoId: string | null
): RoomMaterial[] => [
  ...lesson.assets
    .filter(({ id }) => id !== primaryVideoId)
    .map(
      (asset): RoomMaterial => ({
        external: false,
        href: `/api/learning/assets/${asset.id}`,
        id: `asset:${asset.id}`,
        kind: "file",
        label: assetKindLabel[asset.kind] ?? "Material",
        title: asset.title,
      })
    ),
  ...lesson.resources.map((resource): RoomMaterial => {
    const href = safeResourceUrl(resource.url);
    return {
      external: true,
      href,
      id: `resource:${resource.id}`,
      kind: "link",
      label: resourceKindLabels[resource.kind] ?? "Recurso",
      title: resource.title,
    };
  }),
  ...lesson.activities.map(
    (activity): RoomMaterial => ({
      external: false,
      href: `/atividades/${encodeURIComponent(activity.slug)}`,
      id: `activity:${activity.id}`,
      kind: "activity",
      label: "Atividade",
      title: activity.title,
    })
  ),
];

export const getRoomLesson = async ({
  courseSlug,
  lessonSlug,
  memberId,
  now = new Date(),
  startAt,
}: {
  readonly courseSlug: string;
  readonly lessonSlug: string;
  readonly memberId: string;
  readonly now?: Date;
  readonly startAt?: string | string[];
}): Promise<RoomLessonResult> => {
  const [scope, target] = await Promise.all([
    getLearningAccessScope(memberId),
    database.lesson.findFirst({
      where: {
        slug: lessonSlug,
        ...published,
        module: {
          ...published,
          course: { slug: courseSlug, ...publishedCourse },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, slug: true, title: true } },
          },
        },
      },
    }),
  ]);

  if (!target) {
    return { status: "not_found" };
  }

  const course = target.module.course;
  const access = classifyRoomLessonAccess(scope, {
    courseId: course.id,
    lessonId: target.id,
    moduleId: target.module.id,
  });
  if (access === "forbidden") {
    return { status: "forbidden" };
  }

  const [{ lessons, outline }, lesson] = await Promise.all([
    getRoomCourseOutline(course.id, memberId, scope, target.id, now),
    access === "open"
      ? getPublishedLesson(courseSlug, lessonSlug, memberId)
      : Promise.resolve(null),
  ]);
  const current = lessons.find(({ id }) => id === target.id);
  const base = {
    back: {
      href: `/cursos/${encodeURIComponent(course.slug)}?r=${encodeURIComponent(target.slug)}`,
      label: course.title,
    },
    completed: current?.completed ?? false,
    course,
    id: target.id,
    kind: "lesson" as const,
    linkId: target.id,
    module: { id: target.module.id, title: target.module.title },
    outline,
    slug: target.slug,
    subtitle: null,
    title: target.title,
  };

  if (access === "locked" || !lesson) {
    const releasesAt = roomLessonUnlockDate(scope, target.id) ?? now;
    return {
      status: "ready",
      room: {
        ...base,
        content: null,
        description: null,
        initialPlayerState: "locked",
        locked: true,
        materials: [],
        position: { durationSeconds: null, positionSeconds: 0 },
        releasesAt,
        startAtSeconds: null,
        video: null,
      },
    };
  }

  const primaryAsset =
    lesson.assets.find(({ kind }) => kind === LessonAssetKind.VIDEO) ?? null;
  const videoRow = primaryAsset
    ? await database.lessonAsset.findUnique({
        where: { id: primaryAsset.id },
        select: {
          ...videoAssetSelect,
          playbackProgress: {
            where: { memberId },
            select: { positionSeconds: true, durationSeconds: true },
          },
        },
      })
    : null;
  const video = toRoomVideo(videoRow);
  const playback = videoRow?.playbackProgress[0] ?? null;
  const position = {
    durationSeconds: playback?.durationSeconds ?? null,
    positionSeconds: playback?.positionSeconds ?? 0,
  };
  const startAtSeconds = video
    ? parseStartAt(startAt, video.durationSeconds ?? position.durationSeconds)
    : null;

  return {
    status: "ready",
    room: {
      ...base,
      content: lesson.content,
      description: lesson.description,
      initialPlayerState: resolveInitialPlayerState({
        now,
        position,
        releasesAt: null,
        startAtSeconds,
        video,
      }),
      locked: false,
      materials: lessonMaterials(lesson, primaryAsset?.id ?? null),
      position,
      releasesAt: null,
      startAtSeconds,
      video,
    },
  };
};

// "Continuar": the last lesson the member studied that is still open and not
// done; otherwise the first open lesson not done; otherwise the first open one.
export const resolveContinueLessonHref = async (
  courseSlug: string,
  memberId: string,
  now = new Date()
) => {
  const scope = await getLearningAccessScope(memberId);
  const course = await database.course.findFirst({
    where: { slug: courseSlug, ...publishedCourse },
    select: { id: true, slug: true },
  });
  if (!course) {
    return { status: "not_found" as const };
  }
  const { lessons } = await getRoomCourseOutline(
    course.id,
    memberId,
    scope,
    "",
    now
  );
  if (lessons.length === 0) {
    return scope.fullAccess || scope.courseIds.has(course.id)
      ? {
          href: `/cursos/${encodeURIComponent(course.slug)}`,
          status: "ok" as const,
        }
      : { status: "forbidden" as const };
  }
  const open = lessons.filter(({ releasesAt }) => releasesAt === null);
  const lastStudied = await database.studyTrackingSession.findFirst({
    where: {
      memberId,
      activityKind: StudyActivityKind.LESSON,
      resourceId: {
        in: open.filter(({ completed }) => !completed).map(({ id }) => id),
      },
    },
    orderBy: { lastHeartbeatAt: "desc" },
    select: { resourceId: true },
  });
  const target =
    open.find(({ id }) => id === lastStudied?.resourceId) ??
    open.find(({ completed }) => !completed) ??
    open[0];

  return {
    href: target?.href ?? `/cursos/${encodeURIComponent(course.slug)}`,
    status: "ok" as const,
  };
};

// Titles only for members who may see the lesson; others get a generic title.
export const getRoomLessonTitles = async (
  courseSlug: string,
  lessonSlug: string,
  memberId: string
) => {
  const [scope, lesson] = await Promise.all([
    getLearningAccessScope(memberId),
    database.lesson.findFirst({
      where: {
        slug: lessonSlug,
        ...published,
        module: {
          ...published,
          course: { slug: courseSlug, ...publishedCourse },
        },
      },
      select: {
        id: true,
        title: true,
        module: {
          select: { id: true, course: { select: { id: true, title: true } } },
        },
      },
    }),
  ]);
  if (
    !lesson ||
    classifyRoomLessonAccess(scope, {
      courseId: lesson.module.course.id,
      lessonId: lesson.id,
      moduleId: lesson.module.id,
    }) === "forbidden"
  ) {
    return null;
  }
  return { course: lesson.module.course.title, lesson: lesson.title };
};

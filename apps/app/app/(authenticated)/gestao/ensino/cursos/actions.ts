"use server";

import { randomUUID } from "node:crypto";
import {
  AccessResourceType,
  CohortMemberStatus,
  ContentStatus,
  database,
  EnrollmentStatus,
  LearningAssignmentTargetType,
  LessonAssetKind,
  LessonAssetMediaProvider,
  LessonAssetScope,
  LessonAssetUploadStatus,
  LessonKind,
  type Prisma,
} from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import {
  cohortEndedReadUntil,
  resolveCohortCourseAccess,
} from "@/lib/cohort-domain";
import { sanitizeRichDocument } from "@/lib/community-content";
import { activeGrantFilter } from "@/lib/content-access";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { activeAssignmentStatuses } from "@/lib/learning-assignments";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";
import { getYouTubeDataAdapter } from "@/lib/youtube-adapter";
import { createYouTubePlaylistImportFingerprint } from "@/lib/youtube-playlist-import-contract";
import {
  createYouTubePlaylistImportToken,
  readYouTubePlaylistImportToken,
} from "@/lib/youtube-playlist-import-token";
import {
  isYouTubePlaylistItemImportable,
  parseYouTubePlaylistId,
  verifyYouTubeVideo,
  type YouTubePlaylistItem,
  type YouTubeVerificationResult,
  type YouTubeVideoMetadata,
} from "@/lib/youtube-verification";

export interface GestaoLessonSaveState {
  readonly assetExpectedUpdatedAt: string;
  readonly assetId: string | null;
  readonly expectedUpdatedAt: string;
  readonly idempotencyKey: string;
  readonly message: string;
  readonly status: "idle" | "saved" | "invalid" | "conflict" | "error";
}

class LessonVersionConflict extends Error {}
class PlaylistImportIdempotencyConflict extends Error {}
class PlaylistImportTargetChanged extends Error {}
class PlaylistImportAudienceTooLarge extends Error {}

const formText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

type PlaylistActionErrorCode =
  | "CONFLICT"
  | "INVALID"
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "UNAVAILABLE";

type PlaylistActionResult<T> =
  | { readonly data: T; readonly ok: true }
  | {
      readonly error: {
        readonly code: PlaylistActionErrorCode;
        readonly message: string;
      };
      readonly ok: false;
    };

interface GestaoPlaylistPreviewItem extends YouTubePlaylistItem {
  readonly selectionToken: string | null;
}

const playlistFailure = <T = never>(
  code: PlaylistActionErrorCode,
  message: string
): PlaylistActionResult<T> => ({ ok: false, error: { code, message } });

const isSafePageToken = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 1024) {
    return false;
  }
  return [...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  });
};

const isPublishedContent = (status: string) =>
  status === ContentStatus.PUBLISHED;

const playlistPreviewInputSchema = z.object({
  courseId: z.string().trim().min(1).max(128),
  moduleId: z.string().trim().min(1).max(128),
  pageToken: z.string().max(1024).nullable().optional(),
  playlistUrl: z.string().trim().min(1).max(2048),
});

const playlistImportInputSchema = z.object({
  courseId: z.string().trim().min(1).max(128),
  idempotencyKey: z.string(),
  moduleId: z.string().trim().min(1).max(128),
  selectionTokens: z.array(z.string().max(2048)).min(1).max(200),
  status: z.enum([ContentStatus.DRAFT, ContentStatus.PUBLISHED]),
  useVideoTitle: z.boolean(),
});

export const previewGestaoYouTubePlaylist = async (input: {
  readonly courseId: string;
  readonly moduleId: string;
  readonly pageToken?: string | null;
  readonly playlistUrl: string;
}): Promise<
  PlaylistActionResult<{
    readonly items: GestaoPlaylistPreviewItem[];
    readonly nextPageToken: string | null;
    readonly totalResults: number;
  }>
> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "youtube.verify",
    memberId: actor.userId,
  });

  const parsedInput = playlistPreviewInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return playlistFailure(
      "INVALID",
      "Confira o link da lista e o módulo escolhido."
    );
  }
  const { courseId, moduleId, pageToken, playlistUrl } = parsedInput.data;
  const playlistId = parseYouTubePlaylistId(playlistUrl);
  if (
    !playlistId ||
    (pageToken !== undefined &&
      pageToken !== null &&
      !isSafePageToken(pageToken))
  ) {
    return playlistFailure(
      "INVALID",
      "Informe um link válido de lista do YouTube."
    );
  }

  if (!env.CLERK_SECRET_KEY) {
    return playlistFailure(
      "NOT_CONFIGURED",
      "Não foi possível preparar uma prévia protegida nesta sessão. Recarregue e tente novamente."
    );
  }

  const module = await database.module.findFirst({
    where: { id: moduleId, courseId },
    select: { id: true },
  });
  if (!module) {
    return playlistFailure("NOT_FOUND", "O módulo escolhido não existe mais.");
  }

  let adapter: Awaited<ReturnType<typeof getYouTubeDataAdapter>>["adapter"];
  try {
    ({ adapter } = await getYouTubeDataAdapter());
  } catch {
    return playlistFailure(
      "NOT_CONFIGURED",
      "A integração do YouTube precisa ser configurada no servidor."
    );
  }
  if (!adapter) {
    return playlistFailure(
      "NOT_CONFIGURED",
      "A integração do YouTube ainda não está configurada. Tente novamente mais tarde."
    );
  }

  try {
    const page = await adapter.getPlaylistPage(playlistId, pageToken);
    const expiresAt = Date.now() + 15 * 60_000;
    return {
      ok: true,
      data: {
        items: page.items.map((item) => ({
          ...item,
          selectionToken: createYouTubePlaylistImportToken({
            actorId: actor.userId,
            expiresAt,
            item,
            playlistId,
            secret: env.CLERK_SECRET_KEY as string,
          }),
        })),
        nextPageToken: page.nextPageToken,
        totalResults: page.totalResults,
      },
    };
  } catch {
    return playlistFailure(
      "UNAVAILABLE",
      "Não foi possível carregar esta lista agora. Confira o link e tente novamente."
    );
  }
};

const lessonSlugFor = (title: string, videoId: string) => {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 130)
    .replace(/-+$/g, "");
  return normalized || `video-${videoId.toLowerCase()}`;
};

const parseImportCount = (payload: Prisma.JsonValue) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const importedCount = payload.importedCount;
  const publicCount = payload.publicCount;
  const importFingerprint = payload.importFingerprint;
  return typeof importedCount === "number" &&
    typeof publicCount === "number" &&
    typeof importFingerprint === "string"
    ? { importedCount, importFingerprint, publicCount }
    : null;
};

const readPlaylistImportReplay = (
  event: {
    readonly actorId: string | null;
    readonly aggregateId: string;
    readonly aggregateType: string;
    readonly eventType: string;
    readonly payload: Prisma.JsonValue;
  } | null,
  actorId: string,
  moduleId: string,
  requestFingerprint: string
) => {
  if (!event) {
    return null;
  }
  if (
    event.actorId !== actorId ||
    event.aggregateType !== "Module" ||
    event.aggregateId !== moduleId ||
    event.eventType !== "gestao.youtube.playlist.imported"
  ) {
    throw new PlaylistImportIdempotencyConflict();
  }
  const counts = parseImportCount(event.payload);
  if (!(counts && counts.importFingerprint === requestFingerprint)) {
    throw new PlaylistImportIdempotencyConflict();
  }
  return {
    importedCount: counts.importedCount,
    publicCount: counts.publicCount,
  };
};

type YouTubePlaylistImportClaim = NonNullable<
  ReturnType<typeof readYouTubePlaylistImportToken>
>;

interface VerifiedPlaylistVideo {
  readonly claim: YouTubePlaylistImportClaim;
  readonly metadata: YouTubeVideoMetadata;
}

const readPlaylistImportClaims = (
  tokens: readonly string[],
  actorId: string,
  secret: string
) => {
  const claims = tokens.map((token) =>
    readYouTubePlaylistImportToken(token, { actorId, secret })
  );
  if (
    claims.some((claim) => claim === null) ||
    new Set(tokens).size !== tokens.length
  ) {
    return null;
  }
  const verifiedClaims = claims.filter(
    (claim): claim is YouTubePlaylistImportClaim => claim !== null
  );
  const playlistId = verifiedClaims[0]?.playlistId;
  if (
    !playlistId ||
    verifiedClaims.some((claim) => claim.playlistId !== playlistId)
  ) {
    return null;
  }
  return verifiedClaims.sort((left, right) => left.position - right.position);
};

const recheckPlaylistVideos = async (
  adapter: NonNullable<
    Awaited<ReturnType<typeof getYouTubeDataAdapter>>["adapter"]
  >,
  claims: readonly YouTubePlaylistImportClaim[],
  status: ContentStatus
): Promise<
  PlaylistActionResult<{
    readonly items: VerifiedPlaylistVideo[];
    readonly publicCount: number;
  }>
> => {
  let metadata: ReadonlyMap<string, YouTubeVideoMetadata>;
  try {
    metadata = await adapter.getVideos([
      ...new Set(claims.map((claim) => claim.videoId)),
    ]);
  } catch {
    return playlistFailure(
      "UNAVAILABLE",
      "Não foi possível reconferir os vídeos no YouTube. Nenhuma aula foi criada."
    );
  }

  const items = claims.map((claim) => ({
    claim,
    metadata: metadata.get(claim.videoId) ?? null,
  }));
  const unavailableCount = items.filter(
    ({ metadata: video }) => !isYouTubePlaylistItemImportable(video)
  ).length;
  if (unavailableCount > 0) {
    return playlistFailure(
      "UNAVAILABLE",
      `${unavailableCount} vídeo${unavailableCount === 1 ? "" : "s"} ficou privado, indisponível ou não encontrado. Atualize a prévia; nenhuma aula foi criada.`
    );
  }
  if (
    status === ContentStatus.PUBLISHED &&
    items.some(({ metadata: video }) => video?.embeddable !== true)
  ) {
    return playlistFailure(
      "INVALID",
      "Há vídeo selecionado com a incorporação desativada. Importe como rascunho ou habilite a incorporação."
    );
  }

  const verifiedItems = items.map(({ claim, metadata: video }) => ({
    claim,
    metadata: video as YouTubeVideoMetadata,
  }));
  return {
    ok: true,
    data: {
      items: verifiedItems,
      publicCount: verifiedItems.filter(
        ({ metadata: video }) => video.privacyStatus === "PUBLIC"
      ).length,
    },
  };
};

const readExistingPlaylistImport = async (
  transaction: Prisma.TransactionClient,
  idempotencyKey: string,
  actorId: string,
  moduleId: string,
  requestFingerprint: string
) =>
  readPlaylistImportReplay(
    await transaction.domainEvent.findUnique({
      where: { idempotencyKey },
      select: {
        actorId: true,
        aggregateId: true,
        aggregateType: true,
        eventType: true,
        payload: true,
      },
    }),
    actorId,
    moduleId,
    requestFingerprint
  );

const readStoredPlaylistImport = async (
  idempotencyKey: string,
  actorId: string,
  moduleId: string,
  requestFingerprint: string
) =>
  readPlaylistImportReplay(
    await database.domainEvent.findUnique({
      where: { idempotencyKey },
      select: {
        actorId: true,
        aggregateId: true,
        aggregateType: true,
        eventType: true,
        payload: true,
      },
    }),
    actorId,
    moduleId,
    requestFingerprint
  );

const uniqueLessonSlug = (base: string, usedSlugs: Set<string>) => {
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) {
    const suffixText = `-${suffix}`;
    slug = `${base.slice(0, 160 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  usedSlugs.add(slug);
  return slug;
};

const titleForImportedLesson = (
  useVideoTitle: boolean,
  metadata: YouTubeVideoMetadata,
  claim: YouTubePlaylistImportClaim,
  position: number
) =>
  useVideoTitle
    ? metadata.title.trim().slice(0, 180) ||
      claim.videoTitle.slice(0, 180) ||
      `Aula ${position + 1}`
    : `Aula ${position + 1}`;

interface PlaylistRecipientQuery {
  readonly courseId: string;
  readonly lessonIds: readonly string[];
  readonly moduleId: string;
  readonly now: Date;
}

const loadDirectPlaylistRecipients = async (
  transaction: Prisma.TransactionClient,
  { courseId, now }: PlaylistRecipientQuery,
  resourceTypes: readonly AccessResourceType[],
  resourceIds: readonly string[]
) => {
  const [enrollments, grants, assignments] = await Promise.all([
    transaction.enrollment.findMany({
      where: { courseId, status: EnrollmentStatus.ACTIVE },
      select: { memberId: true },
    }),
    transaction.accessGrant.findMany({
      where: {
        resourceType: { in: [...resourceTypes] },
        resourceId: { in: [...resourceIds] },
        ...activeGrantFilter(now),
      },
      select: { memberId: true },
    }),
    transaction.activityAssignment.findMany({
      where: {
        targetType: {
          in: [
            LearningAssignmentTargetType.COURSE,
            LearningAssignmentTargetType.MODULE,
            LearningAssignmentTargetType.LESSON,
          ],
        },
        targetId: { in: [...resourceIds] },
        status: { in: [...activeAssignmentStatuses] },
        revokedAt: null,
        AND: [
          { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: { memberId: true },
    }),
  ]);
  return new Set([
    ...enrollments.map(({ memberId }) => memberId),
    ...grants.map(({ memberId }) => memberId),
    ...assignments.map(({ memberId }) => memberId),
  ]);
};

const addPlaylistGrantSourceRecipients = async (
  transaction: Prisma.TransactionClient,
  memberIds: Set<string>,
  { now }: PlaylistRecipientQuery,
  resourceTypes: readonly AccessResourceType[],
  resourceIds: readonly string[]
) => {
  const grantSources = await transaction.accessGrantSource.findMany({
    where: {
      resourceType: { in: [...resourceTypes] },
      resourceId: { in: [...resourceIds] },
      revokedAt: null,
      validFrom: { lte: now },
      AND: [{ OR: [{ validUntil: null }, { validUntil: { gt: now } }] }],
    },
    select: {
      createdAt: true,
      subjectMemberId: true,
      subjectCohortId: true,
      subjectCohort: {
        select: {
          archivedAt: true,
          endsAt: true,
          lateJoinPolicy: true,
          readAfterEndDays: true,
        },
      },
    },
  });
  const cohortIds = [
    ...new Set(
      grantSources.flatMap((source) =>
        source.subjectCohortId ? [source.subjectCohortId] : []
      )
    ),
  ];
  const memberships = cohortIds.length
    ? await transaction.cohortMembership.findMany({
        where: {
          cohortId: { in: cohortIds },
          status: CohortMemberStatus.ACTIVE,
          leftAt: null,
          cohort: { startsAt: { lte: now } },
        },
        select: { cohortId: true, joinedAt: true, memberId: true },
      })
    : [];
  const byCohort = new Map<
    string,
    Array<{ cohortId: string; joinedAt: Date; memberId: string }>
  >();
  for (const membership of memberships) {
    const cohortMembers = byCohort.get(membership.cohortId) ?? [];
    cohortMembers.push(membership);
    byCohort.set(membership.cohortId, cohortMembers);
  }

  for (const source of grantSources) {
    if (source.subjectMemberId) {
      memberIds.add(source.subjectMemberId);
      continue;
    }
    const cohort = source.subjectCohort;
    const cohortId = source.subjectCohortId;
    if (!(cohort && cohortId)) {
      continue;
    }
    const readUntil = cohortEndedReadUntil(
      cohort.endsAt ?? cohort.archivedAt,
      cohort.readAfterEndDays
    );
    if (readUntil && now >= readUntil) {
      continue;
    }
    for (const membership of byCohort.get(cohortId) ?? []) {
      if (
        cohort.lateJoinPolicy !== "FROM_JOIN" ||
        source.createdAt >= membership.joinedAt
      ) {
        memberIds.add(membership.memberId);
      }
    }
  }
};

const addPlaylistCourseCohortRecipients = async (
  transaction: Prisma.TransactionClient,
  memberIds: Set<string>,
  { courseId, now }: PlaylistRecipientQuery
) => {
  const memberships = await transaction.cohortMembership.findMany({
    where: {
      status: CohortMemberStatus.ACTIVE,
      leftAt: null,
      cohort: {
        startsAt: { lte: now },
        courseAccesses: {
          some: {
            courseId,
            revokedAt: null,
            AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
          },
        },
      },
    },
    select: {
      memberId: true,
      joinedAt: true,
      leftAt: true,
      cohort: {
        select: {
          archivedAt: true,
          endsAt: true,
          lateJoinPolicy: true,
          readAfterEndDays: true,
          startsAt: true,
          courseAccesses: {
            where: { courseId, revokedAt: null },
            select: {
              createdAt: true,
              releaseMode: true,
              startsAt: true,
              revokedAt: true,
            },
          },
        },
      },
    },
  });
  for (const membership of memberships) {
    const hasEffectiveCourseAccess = membership.cohort.courseAccesses.some(
      (access) =>
        resolveCohortCourseAccess({
          access,
          cohort: membership.cohort,
          membership,
          now,
        }).available
    );
    if (hasEffectiveCourseAccess) {
      memberIds.add(membership.memberId);
    }
  }
};

const resolvePlaylistLessonRecipients = async (
  transaction: Prisma.TransactionClient,
  input: PlaylistRecipientQuery
) => {
  const resourceIds = [input.courseId, input.moduleId, ...input.lessonIds];
  const resourceTypes = [
    AccessResourceType.COURSE,
    AccessResourceType.MODULE,
    AccessResourceType.LESSON,
  ];
  const memberIds = await loadDirectPlaylistRecipients(
    transaction,
    input,
    resourceTypes,
    resourceIds
  );
  await addPlaylistGrantSourceRecipients(
    transaction,
    memberIds,
    input,
    resourceTypes,
    resourceIds
  );
  await addPlaylistCourseCohortRecipients(transaction, memberIds, input);
  const activeMembers = await transaction.member.findMany({
    where: { id: { in: [...memberIds] }, deactivatedAt: null },
    select: { id: true },
  });
  return [...new Set(activeMembers.map(({ id }) => id))];
};

const enqueuePlaylistLessonNotifications = async (
  transaction: Prisma.TransactionClient,
  {
    actorId,
    courseId,
    courseSlug,
    idempotencyKey,
    lessons,
    moduleId,
    now,
  }: {
    readonly actorId: string;
    readonly courseId: string;
    readonly courseSlug: string;
    readonly idempotencyKey: string;
    readonly lessons: readonly {
      readonly id: string;
      readonly slug: string;
      readonly title: string;
    }[];
    readonly moduleId: string;
    readonly now: Date;
  }
) => {
  const recipients = await resolvePlaylistLessonRecipients(transaction, {
    courseId,
    lessonIds: lessons.map(({ id }) => id),
    moduleId,
    now,
  });
  const notifications = lessons.flatMap((lesson) =>
    recipients.map((recipientId) => ({
      recipientId,
      type: "LESSON_AVAILABLE",
      entityType: "LESSON",
      entityId: lesson.id,
      dedupeKey: `lesson-available:${recipientId}:${lesson.id}`,
      body: lesson.title,
      href: `/cursos/${courseSlug}/${lesson.slug}`,
    }))
  );
  if (notifications.length > 10_000) {
    throw new PlaylistImportAudienceTooLarge();
  }
  await enqueueNotificationBatch(transaction, {
    actorId,
    aggregateType: "Module",
    aggregateId: moduleId,
    idempotencyKey: `${idempotencyKey}:lesson-available`,
    occurredAt: now,
    notifications,
  });
};

const createImportedPlaylistLessons = async (
  transaction: Prisma.TransactionClient,
  {
    actorId,
    moduleId,
    status,
    items,
    useVideoTitle,
  }: {
    readonly actorId: string;
    readonly items: readonly VerifiedPlaylistVideo[];
    readonly moduleId: string;
    readonly status: ContentStatus;
    readonly useVideoTitle: boolean;
  }
) => {
  const currentLessons = await transaction.lesson.findMany({
    where: { moduleId },
    select: { position: true, slug: true },
  });
  const usedSlugs = new Set(currentLessons.map(({ slug }) => slug));
  let nextPosition =
    currentLessons.reduce(
      (current, lesson) => Math.max(current, lesson.position),
      -1
    ) + 1;
  const now = new Date();
  const createdLessons: Array<{ id: string; slug: string; title: string }> = [];

  for (const { claim, metadata } of items) {
    const lessonTitle = titleForImportedLesson(
      useVideoTitle,
      metadata,
      claim,
      nextPosition
    );
    const slug = uniqueLessonSlug(
      lessonSlugFor(lessonTitle, claim.videoId),
      usedSlugs
    );
    const lesson = await transaction.lesson.create({
      data: {
        title: lessonTitle,
        slug,
        content: { type: "doc", content: [] },
        kind: LessonKind.VIDEO,
        status,
        position: nextPosition,
        publishedAt: status === ContentStatus.PUBLISHED ? now : null,
        createdBy: actorId,
        updatedBy: actorId,
        moduleId,
      },
      select: { id: true },
    });
    createdLessons.push({ id: lesson.id, slug, title: lessonTitle });
    await transaction.lessonAsset.create({
      data: {
        title: lessonTitle,
        kind: LessonAssetKind.VIDEO,
        scope: LessonAssetScope.GENERAL,
        mediaProvider: LessonAssetMediaProvider.YOUTUBE,
        mediaExternalId: metadata.videoId,
        youtubeSourceUrl: `https://youtu.be/${metadata.videoId}`,
        youtubeVideoTitle: metadata.title,
        youtubeThumbnailUrl: metadata.thumbnailUrl,
        youtubePrivacyStatus: metadata.privacyStatus,
        youtubeEmbeddable: metadata.embeddable,
        youtubeCaptionsAvailable: metadata.captionsAvailable,
        youtubeVerificationStatus: metadata.embeddable
          ? metadata.privacyStatus
          : "EMBEDDING_DISABLED",
        youtubeCheckedAt: now,
        youtubeStartAtSeconds: null,
        youtubeEndAtSeconds: null,
        durationSeconds: metadata.durationSeconds,
        lessonId: lesson.id,
        position: 0,
      },
    });
    nextPosition += 1;
  }
  return { lessons: createdLessons, occurredAt: now };
};

const isRetryablePlaylistImportError = (error: unknown) =>
  isUniqueConstraintError(error) ||
  (typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034");

const commitPlaylistImport = async ({
  actorId,
  courseId,
  idempotencyKey,
  items,
  moduleId,
  publicCount,
  requestFingerprint,
  status,
  useVideoTitle,
}: {
  readonly actorId: string;
  readonly courseId: string;
  readonly idempotencyKey: string;
  readonly items: readonly VerifiedPlaylistVideo[];
  readonly moduleId: string;
  readonly publicCount: number;
  readonly requestFingerprint: string;
  readonly status: ContentStatus;
  readonly useVideoTitle: boolean;
}): Promise<
  PlaylistActionResult<{ importedCount: number; publicCount: number }>
> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counts = await database.$transaction(
        async (transaction) => {
          const replay = await readExistingPlaylistImport(
            transaction,
            idempotencyKey,
            actorId,
            moduleId,
            requestFingerprint
          );
          if (replay) {
            return replay;
          }

          const targetModule = await transaction.module.findFirst({
            where: { id: moduleId, courseId },
            select: {
              id: true,
              status: true,
              course: { select: { id: true, slug: true, status: true } },
            },
          });
          if (
            !targetModule ||
            (status === ContentStatus.PUBLISHED &&
              !(
                isPublishedContent(targetModule.status) &&
                isPublishedContent(targetModule.course.status)
              ))
          ) {
            throw new PlaylistImportTargetChanged();
          }

          const imported = await createImportedPlaylistLessons(transaction, {
            actorId,
            items,
            moduleId,
            status,
            useVideoTitle,
          });
          if (status === ContentStatus.PUBLISHED) {
            await enqueuePlaylistLessonNotifications(transaction, {
              actorId,
              courseId,
              courseSlug: targetModule.course.slug,
              idempotencyKey,
              lessons: imported.lessons,
              moduleId,
              now: imported.occurredAt,
            });
          }
          await transaction.domainEvent.create({
            data: {
              eventType: "gestao.youtube.playlist.imported",
              actorId,
              aggregateType: "Module",
              aggregateId: moduleId,
              idempotencyKey,
              payload: {
                courseId,
                importedCount: items.length,
                importFingerprint: requestFingerprint,
                moduleId,
                publicCount,
                status,
              },
              occurredAt: imported.occurredAt,
            },
          });
          return { importedCount: items.length, publicCount };
        },
        { isolationLevel: "Serializable", timeout: 20_000 }
      );
      return { ok: true, data: counts };
    } catch (error) {
      if (error instanceof PlaylistImportTargetChanged) {
        return playlistFailure(
          "CONFLICT",
          "O curso ou módulo mudou durante a importação. Confira o estado e tente novamente."
        );
      }
      if (error instanceof PlaylistImportIdempotencyConflict) {
        return playlistFailure(
          "CONFLICT",
          "Esta confirmação já foi usada em outra ação. Recarregue e tente novamente."
        );
      }
      if (error instanceof PlaylistImportAudienceTooLarge) {
        return playlistFailure(
          "INVALID",
          "Este envio alcança mais de 10.000 notificações. Importe em lotes menores."
        );
      }
      if (isRetryablePlaylistImportError(error) && attempt < 2) {
        continue;
      }
      if (isRetryablePlaylistImportError(error)) {
        return playlistFailure(
          "CONFLICT",
          "O módulo mudou em outra aba. Recarregue a página e tente novamente."
        );
      }
      throw error;
    }
  }
  return playlistFailure(
    "CONFLICT",
    "A importação não foi concluída. Tente novamente."
  );
};

export const importGestaoYouTubePlaylist = async (input: {
  readonly courseId: string;
  readonly idempotencyKey: string;
  readonly moduleId: string;
  readonly selectionTokens: readonly string[];
  readonly status: "DRAFT" | "PUBLISHED";
  readonly useVideoTitle: boolean;
}): Promise<
  PlaylistActionResult<{
    readonly importedCount: number;
    readonly publicCount: number;
  }>
> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });

  const parsedInput = playlistImportInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return playlistFailure(
      "INVALID",
      "Confira os vídeos selecionados e tente novamente."
    );
  }
  const {
    courseId,
    idempotencyKey: idempotencyKeyValue,
    moduleId,
    selectionTokens,
    status,
    useVideoTitle,
  } = parsedInput.data;
  const idempotencyKey = readIdempotencyKey(idempotencyKeyValue);
  if (!idempotencyKey) {
    return playlistFailure(
      "INVALID",
      "Confira os vídeos selecionados e tente novamente."
    );
  }
  if (!env.CLERK_SECRET_KEY) {
    return playlistFailure(
      "NOT_CONFIGURED",
      "A validação segura da prévia não está configurada. Recarregue e tente novamente."
    );
  }

  const claims = readPlaylistImportClaims(
    selectionTokens,
    actor.userId,
    env.CLERK_SECRET_KEY
  );
  if (!claims) {
    return playlistFailure(
      "INVALID",
      "A prévia expirou ou os vídeos selecionados mudaram. Carregue a lista novamente."
    );
  }
  const requestFingerprint = createYouTubePlaylistImportFingerprint({
    claims,
    courseId,
    moduleId,
    status,
    useVideoTitle,
  });

  const module = await database.module.findFirst({
    where: { id: moduleId, courseId },
    select: {
      id: true,
      status: true,
      course: { select: { id: true, status: true } },
    },
  });
  if (!module) {
    return playlistFailure("NOT_FOUND", "O módulo escolhido não existe mais.");
  }
  if (
    status === ContentStatus.PUBLISHED &&
    !(
      isPublishedContent(module.status) &&
      isPublishedContent(module.course.status)
    )
  ) {
    return playlistFailure(
      "INVALID",
      "Publique o curso e o módulo antes de importar aulas já publicadas."
    );
  }

  let replay: ReturnType<typeof readPlaylistImportReplay>;
  try {
    replay = await readStoredPlaylistImport(
      idempotencyKey,
      actor.userId,
      moduleId,
      requestFingerprint
    );
  } catch (error) {
    if (error instanceof PlaylistImportIdempotencyConflict) {
      return playlistFailure(
        "CONFLICT",
        "Esta confirmação já foi usada em outra ação. Recarregue e tente novamente."
      );
    }
    throw error;
  }
  if (replay) {
    return { ok: true, data: replay };
  }

  let adapter: Awaited<ReturnType<typeof getYouTubeDataAdapter>>["adapter"];
  try {
    ({ adapter } = await getYouTubeDataAdapter());
  } catch {
    return playlistFailure(
      "NOT_CONFIGURED",
      "A integração do YouTube precisa ser configurada no servidor."
    );
  }
  if (!adapter) {
    return playlistFailure(
      "NOT_CONFIGURED",
      "A integração do YouTube ainda não está configurada. Tente novamente mais tarde."
    );
  }

  const verified = await recheckPlaylistVideos(adapter, claims, status);
  if (!verified.ok) {
    return verified;
  }
  const saved = await commitPlaylistImport({
    actorId: actor.userId,
    courseId,
    idempotencyKey,
    items: verified.data.items,
    moduleId,
    publicCount: verified.data.publicCount,
    requestFingerprint,
    status,
    useVideoTitle,
  });
  if (!saved.ok) {
    return saved;
  }

  revalidatePath(`/gestao/ensino/cursos/${courseId}`);
  revalidatePath("/cursos");
  if (status === ContentStatus.PUBLISHED) {
    await dispatchPendingNotifications();
  }
  return saved;
};

const lineBreakPattern = /\r?\n/;
const lessonSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedYouTubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const parseOptionalSeconds = (value: string) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 86_400
    ? parsed
    : Number.NaN;
};

const checkedAtFor = (
  status: YouTubeVerificationResult["status"],
  sameVideo: boolean,
  previousCheck: Date | null | undefined
) => {
  if (status !== "NOT_CONFIGURED") {
    return new Date();
  }
  return sameVideo ? (previousCheck ?? null) : null;
};

const youtubeSourceUrlFor = (sourceUrl: string, videoId: string | null) => {
  if (videoId) {
    return `https://youtu.be/${videoId}`;
  }
  try {
    const url = new URL(sourceUrl);
    return url.protocol === "https:" && allowedYouTubeHosts.has(url.hostname)
      ? url.toString().slice(0, 2000)
      : null;
  } catch {
    return null;
  }
};

const youtubeAssetFields = (
  verification: YouTubeVerificationResult,
  sourceUrl: string,
  startAtSeconds: number | null,
  endAtSeconds: number | null,
  sameVideo: boolean,
  current?: {
    readonly youtubeVideoTitle: string | null;
    readonly youtubeThumbnailUrl: string | null;
    readonly youtubePrivacyStatus: string | null;
    readonly youtubeEmbeddable: boolean | null;
    readonly youtubeCaptionsAvailable: boolean | null;
    readonly youtubeCheckedAt: Date | null;
    readonly durationSeconds: number | null;
  }
): Prisma.LessonAssetUpdateManyMutationInput => ({
  mediaProvider: LessonAssetMediaProvider.YOUTUBE,
  mediaExternalId: verification.videoId,
  externalUrl: null,
  youtubeSourceUrl: youtubeSourceUrlFor(sourceUrl, verification.videoId),
  youtubeVideoTitle:
    verification.metadata?.title ??
    (sameVideo ? current?.youtubeVideoTitle : null),
  youtubeThumbnailUrl:
    verification.metadata?.thumbnailUrl ??
    (sameVideo ? current?.youtubeThumbnailUrl : null),
  youtubePrivacyStatus:
    verification.metadata?.privacyStatus ??
    (sameVideo ? current?.youtubePrivacyStatus : null),
  youtubeEmbeddable:
    verification.metadata?.embeddable ??
    (sameVideo ? current?.youtubeEmbeddable : null),
  youtubeCaptionsAvailable:
    verification.metadata?.captionsAvailable ??
    (sameVideo ? current?.youtubeCaptionsAvailable : null),
  youtubeVerificationStatus: verification.status,
  youtubeCheckedAt: checkedAtFor(
    verification.status,
    sameVideo,
    current?.youtubeCheckedAt
  ),
  youtubeStartAtSeconds: startAtSeconds,
  youtubeEndAtSeconds: endAtSeconds,
  durationSeconds:
    verification.metadata?.durationSeconds ??
    (sameVideo ? current?.durationSeconds : null),
});

export const verifyGestaoYouTubeVideo = async (
  lessonId: string,
  videoUrl: string
) => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "youtube.verify",
    memberId: actor.userId,
  });

  if (!(lessonId.length > 0 && lessonId.length <= 128)) {
    return {
      status: "INVALID" as const,
      source: "TEST" as const,
      videoId: null,
      metadata: null,
    };
  }

  const lesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true },
  });
  if (!lesson) {
    return {
      status: "INVALID" as const,
      source: "TEST" as const,
      videoId: null,
      metadata: null,
    };
  }

  const { adapter } = await getYouTubeDataAdapter();
  return verifyYouTubeVideo(videoUrl, adapter);
};

export const saveGestaoLesson = async (
  previousState: GestaoLessonSaveState,
  formData: FormData
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The action validates editor fields, verifies remote media, and coordinates the versioned write.
): Promise<GestaoLessonSaveState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });

  const lessonId = formText(formData, "lessonId");
  const courseId = formText(formData, "courseId");
  const title = formText(formData, "title").slice(0, 180);
  const slug = formText(formData, "slug").toLowerCase();
  const description = formText(formData, "description").slice(0, 5000);
  const objectives = formText(formData, "objectives")
    .split(lineBreakPattern)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  const kind = formText(formData, "kind");
  const expectedUpdatedAt = new Date(formText(formData, "expectedUpdatedAt"));
  const assetId = formText(formData, "assetId") || null;
  const videoUploadId = formText(formData, "videoUploadId") || null;
  const assetExpectedUpdatedAtText = formText(
    formData,
    "assetExpectedUpdatedAt"
  );
  const assetExpectedUpdatedAt = assetExpectedUpdatedAtText
    ? new Date(assetExpectedUpdatedAtText)
    : null;
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));
  const providerValue = formText(formData, "mediaProvider");
  const provider = Object.values(LessonAssetMediaProvider).includes(
    providerValue as LessonAssetMediaProvider
  )
    ? (providerValue as LessonAssetMediaProvider)
    : null;
  const startAtSeconds = parseOptionalSeconds(
    formText(formData, "youtubeStartAtSeconds")
  );
  const endAtSeconds = parseOptionalSeconds(
    formText(formData, "youtubeEndAtSeconds")
  );

  const result = (
    status: GestaoLessonSaveState["status"],
    message: string
  ): GestaoLessonSaveState => ({
    ...previousState,
    status,
    message,
  });

  if (
    !(
      lessonId &&
      courseId &&
      title &&
      lessonSlugPattern.test(slug) &&
      Object.values(LessonKind).includes(kind as LessonKind) &&
      Number.isFinite(expectedUpdatedAt.valueOf()) &&
      idempotencyKey &&
      provider &&
      !Number.isNaN(startAtSeconds) &&
      !Number.isNaN(endAtSeconds) &&
      !(
        startAtSeconds !== null &&
        endAtSeconds !== null &&
        endAtSeconds <= startAtSeconds
      ) &&
      (assetId
        ? Number.isFinite(assetExpectedUpdatedAt?.valueOf())
        : !assetExpectedUpdatedAtText)
    )
  ) {
    return result("invalid", "Confira os campos da aula e tente novamente.");
  }

  let content: ReturnType<typeof sanitizeRichDocument> = null;
  try {
    content = sanitizeRichDocument(
      JSON.parse(formText(formData, "contentJson")) as unknown
    );
  } catch {
    return result("invalid", "O conteúdo da aula não pôde ser validado.");
  }
  if (!content) {
    return result("invalid", "O conteúdo da aula não pôde ser validado.");
  }

  const youtubeUrl = formText(formData, "youtubeUrl");
  const currentAsset = assetId
    ? await database.lessonAsset.findFirst({
        where: { id: assetId, lessonId },
        select: {
          id: true,
          updatedAt: true,
          mediaProvider: true,
          storagePath: true,
          mimeType: true,
          sizeBytes: true,
          mediaExternalId: true,
          youtubeVideoTitle: true,
          youtubeThumbnailUrl: true,
          youtubePrivacyStatus: true,
          youtubeEmbeddable: true,
          youtubeCaptionsAvailable: true,
          youtubeCheckedAt: true,
          durationSeconds: true,
        },
      })
    : null;
  if (assetId && !currentAsset) {
    return result("conflict", "O vídeo desta aula mudou. Recarregue a página.");
  }

  const videoUpload = videoUploadId
    ? await database.lessonAssetUpload.findFirst({
        where: { id: videoUploadId, actorId: actor.userId, lessonId },
        select: {
          id: true,
          assetId: true,
          expectedAssetId: true,
          expectedAssetUpdatedAt: true,
          storagePath: true,
          originalFileName: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          expiresAt: true,
        },
      })
    : null;
  if (videoUploadId && !videoUpload) {
    return result(
      "conflict",
      "O vídeo enviado não está disponível. Envie o arquivo novamente."
    );
  }
  if (
    videoUpload &&
    provider === LessonAssetMediaProvider.STORAGE &&
    !(
      videoUpload.status === LessonAssetUploadStatus.READY ||
      (videoUpload.status === LessonAssetUploadStatus.COMPLETED &&
        videoUpload.assetId === currentAsset?.id &&
        currentAsset.storagePath === videoUpload.storagePath)
    )
  ) {
    return result(
      "conflict",
      "O envio do vídeo ainda não foi confirmado. Tente novamente."
    );
  }
  if (
    videoUpload?.status === LessonAssetUploadStatus.READY &&
    (videoUpload.expiresAt.getTime() <= Date.now() ||
      videoUpload.expectedAssetId !== assetId ||
      videoUpload.expectedAssetUpdatedAt?.getTime() !==
        assetExpectedUpdatedAt?.getTime())
  ) {
    return result(
      "conflict",
      "O vídeo da aula mudou. Recarregue e confirme a versão atual."
    );
  }

  let mediaData: Prisma.LessonAssetUpdateManyMutationInput | null = null;
  if (provider === LessonAssetMediaProvider.YOUTUBE) {
    const { adapter } = await getYouTubeDataAdapter();
    const verification = await verifyYouTubeVideo(youtubeUrl, adapter);
    mediaData = youtubeAssetFields(
      verification,
      youtubeUrl,
      startAtSeconds,
      endAtSeconds,
      verification.videoId === currentAsset?.mediaExternalId,
      currentAsset ?? undefined
    );
    mediaData = {
      ...mediaData,
      storagePath: null,
      mimeType: null,
      sizeBytes: null,
    };
  } else if (provider === LessonAssetMediaProvider.EXTERNAL_URL) {
    let externalUrl: string | null = null;
    try {
      const url = new URL(formText(formData, "externalUrl"));
      if (url.protocol === "http:" || url.protocol === "https:") {
        externalUrl = url.toString().slice(0, 2000);
      }
    } catch {
      // An invalid URL is reported as a form error below.
    }
    if (!externalUrl) {
      return result("invalid", "Informe uma URL externa válida.");
    }
    mediaData = {
      mediaProvider: LessonAssetMediaProvider.EXTERNAL_URL,
      mediaExternalId: null,
      externalUrl,
      storagePath: null,
      mimeType: null,
      sizeBytes: null,
      youtubeSourceUrl: null,
      youtubeVideoTitle: null,
      youtubeThumbnailUrl: null,
      youtubePrivacyStatus: null,
      youtubeEmbeddable: null,
      youtubeCaptionsAvailable: null,
      youtubeVerificationStatus: null,
      youtubeCheckedAt: null,
      youtubeStartAtSeconds: null,
      youtubeEndAtSeconds: null,
      durationSeconds: null,
    };
  } else if (provider === LessonAssetMediaProvider.STORAGE) {
    if (videoUpload?.status === LessonAssetUploadStatus.READY) {
      mediaData = {
        mediaProvider: LessonAssetMediaProvider.STORAGE,
        mediaExternalId: null,
        externalUrl: null,
        storagePath: videoUpload.storagePath,
        mimeType: videoUpload.mimeType,
        sizeBytes: videoUpload.sizeBytes,
        youtubeSourceUrl: null,
        youtubeVideoTitle: null,
        youtubeThumbnailUrl: null,
        youtubePrivacyStatus: null,
        youtubeEmbeddable: null,
        youtubeCaptionsAvailable: null,
        youtubeVerificationStatus: null,
        youtubeCheckedAt: null,
        youtubeStartAtSeconds: null,
        youtubeEndAtSeconds: null,
        durationSeconds: null,
        originalTitle: videoUpload.originalFileName,
      };
    } else if (
      currentAsset?.storagePath &&
      currentAsset.mediaProvider === LessonAssetMediaProvider.STORAGE
    ) {
      mediaData = {
        mediaProvider: LessonAssetMediaProvider.STORAGE,
        mediaExternalId: null,
        externalUrl: null,
        youtubeSourceUrl: null,
        youtubeVideoTitle: null,
        youtubeThumbnailUrl: null,
        youtubePrivacyStatus: null,
        youtubeEmbeddable: null,
        youtubeCaptionsAvailable: null,
        youtubeVerificationStatus: null,
        youtubeCheckedAt: null,
        youtubeStartAtSeconds: null,
        youtubeEndAtSeconds: null,
        durationSeconds: currentAsset.durationSeconds,
      };
    } else if (currentAsset) {
      return result(
        "invalid",
        "Envie um vídeo MP4 ou WebM antes de salvar a aula."
      );
    }
  }

  let currentAssetId = assetId;
  try {
    await database.$transaction(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Version checks, lesson and asset writes, and the audit event share one transaction.
      async (transaction) => {
        const previousEvent = await transaction.domainEvent.findUnique({
          where: { idempotencyKey },
          select: { aggregateId: true },
        });
        if (previousEvent) {
          if (previousEvent.aggregateId !== lessonId) {
            throw new LessonVersionConflict();
          }
          return;
        }

        const currentLesson = await transaction.lesson.findFirst({
          where: { id: lessonId, module: { courseId } },
          select: { updatedAt: true },
        });
        if (
          !currentLesson ||
          currentLesson.updatedAt.getTime() !== expectedUpdatedAt.getTime()
        ) {
          throw new LessonVersionConflict();
        }

        if (videoUpload?.status === LessonAssetUploadStatus.READY) {
          const uploadStillReady =
            await transaction.lessonAssetUpload.findFirst({
              where: {
                id: videoUpload.id,
                actorId: actor.userId,
                lessonId,
                status: LessonAssetUploadStatus.READY,
                expiresAt: { gt: new Date() },
                expectedAssetId: videoUpload.expectedAssetId,
                expectedAssetUpdatedAt: videoUpload.expectedAssetUpdatedAt,
              },
              select: { id: true },
            });
          if (!uploadStillReady) {
            throw new LessonVersionConflict();
          }
        }

        if (assetId) {
          const assetStillCurrent = await transaction.lessonAsset.findFirst({
            where: {
              id: assetId,
              lessonId,
              updatedAt: assetExpectedUpdatedAt as Date,
            },
            select: { id: true },
          });
          if (!assetStillCurrent) {
            throw new LessonVersionConflict();
          }
        }

        const lessonUpdate = await transaction.lesson.updateMany({
          where: { id: lessonId, updatedAt: expectedUpdatedAt },
          data: {
            title,
            slug,
            description: description || null,
            objectives,
            content: content as Prisma.InputJsonValue,
            kind: kind as LessonKind,
            updatedBy: actor.userId,
          },
        });
        if (lessonUpdate.count !== 1) {
          throw new LessonVersionConflict();
        }

        if (mediaData && assetId) {
          const assetUpdate = await transaction.lessonAsset.updateMany({
            where: {
              id: assetId,
              lessonId,
              updatedAt: assetExpectedUpdatedAt as Date,
            },
            data: mediaData,
          });
          if (assetUpdate.count !== 1) {
            throw new LessonVersionConflict();
          }
        } else if (mediaData) {
          const position = await transaction.lessonAsset.aggregate({
            where: { lessonId },
            _max: { position: true },
          });
          const createdAsset = await transaction.lessonAsset.create({
            data: {
              lessonId,
              title,
              kind: LessonAssetKind.VIDEO,
              position: (position._max.position ?? -1) + 1,
              ...mediaData,
            } as Prisma.LessonAssetUncheckedCreateInput,
          });
          currentAssetId = createdAsset.id;
        }

        if (videoUpload?.status === LessonAssetUploadStatus.READY) {
          const completedUpload =
            await transaction.lessonAssetUpload.updateMany({
              where: {
                id: videoUpload.id,
                actorId: actor.userId,
                lessonId,
                status: LessonAssetUploadStatus.READY,
              },
              data: {
                status: LessonAssetUploadStatus.COMPLETED,
                assetId: currentAssetId,
                completedAt: new Date(),
              },
            });
          if (completedUpload.count !== 1) {
            throw new LessonVersionConflict();
          }
        }

        await transaction.domainEvent.create({
          data: {
            eventType: "gestao.lesson.edited",
            actorId: actor.userId,
            aggregateType: "Lesson",
            aggregateId: lessonId,
            idempotencyKey,
            payload: {
              courseId,
              mediaProvider: provider,
              verificationStatus: mediaData?.youtubeVerificationStatus ?? null,
              videoUploadId: videoUpload?.id ?? null,
            },
            occurredAt: new Date(),
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (
      error instanceof LessonVersionConflict ||
      isUniqueConstraintError(error) ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034")
    ) {
      return result(
        "conflict",
        "A aula mudou em outra aba. Recarregue a versão atual antes de salvar."
      );
    }
    throw error;
  }

  const savedLesson = await database.lesson.findUnique({
    where: { id: lessonId },
    select: { updatedAt: true },
  });
  const savedAssetId = currentAssetId ?? assetId;
  const savedAsset = savedAssetId
    ? await database.lessonAsset.findUnique({
        where: { id: savedAssetId },
        select: { updatedAt: true },
      })
    : null;
  revalidatePath(`/gestao/ensino/cursos/${courseId}`);
  revalidatePath(`/gestao/ensino/cursos/${courseId}/aulas/${lessonId}`);
  revalidatePath("/cursos");

  return {
    ...previousState,
    status: "saved",
    message: "Alterações salvas.",
    expectedUpdatedAt: (savedLesson?.updatedAt ?? new Date()).toISOString(),
    assetId: savedAssetId,
    assetExpectedUpdatedAt: savedAsset?.updatedAt.toISOString() ?? "",
    idempotencyKey: randomUUID(),
  };
};

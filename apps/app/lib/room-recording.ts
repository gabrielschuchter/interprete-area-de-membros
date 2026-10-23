import "server-only";

import {
  database,
  LearningAssignmentTargetType,
  LessonAssetKind,
} from "@repo/database";
import {
  roomReleaseDate,
  roomReleaseDateShort,
  roomText,
} from "@/components/learning/room/room-copy";
import { markLearningAssignmentCompleted } from "./learning-assignments";
import { recordingOwnerDisplayLabel } from "./recording-identity";
import { roomRecordingHref } from "./recording-navigation";
import {
  getAccessibleRecordingIds,
  getRecordingAccessContext,
} from "./recordings";
import {
  type RoomLessonResult,
  type RoomVideoAsset,
  toRoomVideo,
  videoAssetSelect,
} from "./room";
import { buildRoomOutline } from "./room-outline";
import {
  parseStartAt,
  resolveInitialPlayerState,
  videoAssetAvailability,
} from "./room-player-state";
import {
  compareRecordingsByDate,
  isRecordingCompleted,
} from "./room-recording-rules";

const MAX_SERIES_ITEMS = 200;

const playbackSelect = (memberId: string) =>
  ({
    where: { memberId },
    select: {
      completedPlaybackAt: true,
      durationSeconds: true,
      manualCompletion: true,
      positionSeconds: true,
    },
    take: 1,
  }) as const;

// The room for one imported recording: the player, the series it belongs to
// and this member's progress. Access reuses the archive rules, so a recording
// the archive hides stays hidden here.
export const getRoomRecording = async ({
  assetId,
  memberId,
  now = new Date(),
  startAt,
}: {
  readonly assetId: string;
  readonly memberId: string;
  readonly now?: Date;
  readonly startAt?: string | string[];
}): Promise<RoomLessonResult> => {
  const target = await database.importedRecording.findFirst({
    where: { assetId, asset: { kind: LessonAssetKind.VIDEO } },
    select: {
      group: {
        select: {
          id: true,
          legacyStudentName: true,
          legacyModule: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, slug: true, title: true } },
            },
          },
          memberId: true,
        },
      },
      groupId: true,
      id: true,
      legacyLesson: { select: { id: true, slug: true, title: true } },
      meetingDate: true,
      asset: {
        select: {
          ...videoAssetSelect,
          playbackProgress: playbackSelect(memberId),
        },
      },
    },
  });
  if (!target) {
    return { status: "not_found" };
  }

  const [access, siblings] = await Promise.all([
    getRecordingAccessContext(memberId),
    database.importedRecording.findMany({
      where: {
        groupId: target.groupId,
        asset: { kind: LessonAssetKind.VIDEO },
      },
      take: MAX_SERIES_ITEMS,
      select: {
        id: true,
        meetingDate: true,
        asset: {
          select: {
            ...videoAssetSelect,
            playbackProgress: playbackSelect(memberId),
          },
        },
      },
    }),
  ]);
  const accessibleIds = await getAccessibleRecordingIds(
    memberId,
    siblings.map(({ id }) => id).concat(target.id)
  );
  if (!accessibleIds.has(target.id)) {
    return { status: "forbidden" };
  }

  const displayLabel = recordingOwnerDisplayLabel(
    target.group.memberId,
    memberId,
    access.fullAccess,
    target.group.legacyStudentName
  );
  const seriesTitle = target.group.legacyModule.course.title;
  const items = siblings
    .filter(({ id }) => accessibleIds.has(id))
    .sort(compareRecordingsByDate)
    .map((recording) => {
      const playback = recording.asset.playbackProgress[0] ?? null;
      return {
        completed: isRecordingCompleted(playback),
        durationSeconds:
          recording.asset.durationSeconds ?? playback?.durationSeconds ?? null,
        href: roomRecordingHref(recording.asset.id),
        id: recording.asset.id,
        label: recording.meetingDate
          ? roomReleaseDateShort(recording.meetingDate)
          : null,
        positionSeconds: playback?.positionSeconds ?? 0,
        releasesAt: null,
        title: recording.asset.title,
        videoAvailability: videoAssetAvailability(recording.asset),
      };
    });

  const video: RoomVideoAsset | null = toRoomVideo(target.asset);
  const playback = target.asset.playbackProgress[0] ?? null;
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
      back: {
        href: "/encontros/gravacoes",
        label: roomText("backToRecordings"),
      },
      completed: isRecordingCompleted(playback),
      content: null,
      course: target.group.legacyModule.course,
      description: null,
      id: target.asset.id,
      initialPlayerState: resolveInitialPlayerState({
        now,
        position,
        releasesAt: null,
        startAtSeconds,
        video,
      }),
      kind: "recording",
      linkId: target.legacyLesson.id,
      locked: false,
      materials: [],
      module: { id: target.group.id, title: displayLabel },
      outline: buildRoomOutline({
        currentLessonId: target.asset.id,
        modules: [{ id: target.group.id, lessons: items, title: displayLabel }],
        now,
      }),
      position,
      releasesAt: null,
      slug: target.legacyLesson.slug,
      startAtSeconds,
      subtitle: target.meetingDate
        ? roomText("subtitleRecording", {
            data: roomReleaseDate(target.meetingDate),
            serie: seriesTitle,
          })
        : roomText("subtitleRecordingNoDate", { serie: seriesTitle }),
      title: target.asset.title,
      video,
    },
  };
};

// Absolute value, never a toggle. The choice lives in manualCompletion so the
// playback route, which rewrites completedPlaybackAt on every save, cannot
// undo it.
export const setRecordingCompletion = async (
  memberId: string,
  assetId: string,
  completed: boolean
): Promise<{ readonly message?: string; readonly ok: boolean }> => {
  const recording = await database.importedRecording.findFirst({
    where: { assetId, asset: { kind: LessonAssetKind.VIDEO } },
    select: { id: true },
  });
  if (!recording) {
    return { message: "A gravação não está disponível.", ok: false };
  }
  const accessible = await getAccessibleRecordingIds(memberId, [recording.id]);
  if (!accessible.has(recording.id)) {
    return { message: "Você não tem acesso a esta gravação.", ok: false };
  }

  await database.playbackProgress.upsert({
    where: { memberId_assetId: { assetId, memberId } },
    create: { assetId, manualCompletion: completed, memberId },
    update: { manualCompletion: completed },
    select: { id: true },
  });
  if (completed) {
    const at = new Date();
    await markLearningAssignmentCompleted(
      memberId,
      LearningAssignmentTargetType.RECORDING,
      recording.id,
      at
    );
    await markLearningAssignmentCompleted(
      memberId,
      LearningAssignmentTargetType.ASSET,
      assetId,
      at
    );
  }
  return { ok: true };
};

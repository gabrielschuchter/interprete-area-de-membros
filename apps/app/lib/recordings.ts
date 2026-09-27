import "server-only";

import { database, MemberRole } from "@repo/database";
import { getMemberRole } from "./authorization";

export interface RecordingAccessContext {
  readonly fullAccess: boolean;
  readonly memberId: string;
}

export const canReadRecordingGroup = (
  groupMemberId: string | null,
  context: RecordingAccessContext
) => context.fullAccess || groupMemberId === context.memberId;

const getRecordingAccessContext = async (
  memberId: string
): Promise<RecordingAccessContext> => {
  const role = await getMemberRole(memberId);

  return {
    memberId,
    fullAccess: role === MemberRole.ADMIN || role === MemberRole.TEACHER,
  };
};

const recordingGroupSelection = (memberId: string) => ({
  id: true,
  sourcePlatform: true,
  sourceId: true,
  legacyStudentName: true,
  memberId: true,
  legacyModule: {
    select: {
      title: true,
      course: { select: { title: true, slug: true } },
    },
  },
  recordings: {
    orderBy: { legacyLesson: { position: "asc" as const } },
    select: {
      id: true,
      sourcePlatform: true,
      sourceId: true,
      originalTitle: true,
      meetingDate: true,
      legacyLesson: { select: { title: true, position: true } },
      asset: {
        select: {
          id: true,
          title: true,
          kind: true,
          mimeType: true,
          durationSeconds: true,
          playbackProgress: {
            where: { memberId },
            select: {
              positionSeconds: true,
              durationSeconds: true,
              lastViewedAt: true,
              completedPlaybackAt: true,
            },
            take: 1,
          },
        },
      },
    },
  },
});

/**
 * The home page only needs the few recordings the member can resume. Keeping
 * this query separate from the archive listing avoids loading every imported
 * group, lesson and playback row into the first render.
 */
export const getMemberContinueWatching = async (memberId: string) => {
  const access = await getRecordingAccessContext(memberId);
  const progressRows = await database.playbackProgress.findMany({
    where: {
      memberId,
      positionSeconds: { gt: 0 },
      completedPlaybackAt: null,
      asset: {
        importedRecording: access.fullAccess
          ? { isNot: null }
          : { is: { group: { memberId } } },
      },
    },
    orderBy: { lastViewedAt: "desc" },
    take: 6,
    select: {
      positionSeconds: true,
      durationSeconds: true,
      lastViewedAt: true,
      completedPlaybackAt: true,
      asset: {
        select: {
          id: true,
          title: true,
          kind: true,
          mimeType: true,
          durationSeconds: true,
          importedRecording: {
            select: {
              group: {
                select: {
                  id: true,
                  legacyStudentName: true,
                  legacyModule: {
                    select: {
                      title: true,
                      course: { select: { title: true, slug: true } },
                    },
                  },
                },
              },
              legacyLesson: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  return {
    access,
    continueWatching: progressRows.flatMap((row) => {
      const importedRecording = row.asset.importedRecording;
      if (!importedRecording) {
        return [];
      }

      return [
        {
          asset: {
            id: row.asset.id,
            title: row.asset.title,
            kind: row.asset.kind,
            mimeType: row.asset.mimeType,
            durationSeconds: row.asset.durationSeconds,
          },
          group: {
            id: importedRecording.group.id,
            legacyStudentName: importedRecording.group.legacyStudentName,
            courseTitle: importedRecording.group.legacyModule.course.title,
            moduleTitle: importedRecording.group.legacyModule.title,
          },
          legacyLesson: importedRecording.legacyLesson,
          progress: {
            positionSeconds: row.positionSeconds,
            durationSeconds: row.durationSeconds,
            lastViewedAt: row.lastViewedAt,
            completedPlaybackAt: row.completedPlaybackAt,
          },
        },
      ];
    }),
  };
};

export const getMemberRecordingLibrary = async (memberId: string) => {
  const access = await getRecordingAccessContext(memberId);
  const groups = await database.importedRecordingGroup.findMany({
    where: access.fullAccess ? undefined : { memberId },
    orderBy: [{ updatedAt: "desc" }, { legacyStudentName: "asc" }],
    take: 40,
    select: recordingGroupSelection(memberId),
  });

  const recordings = groups.flatMap((group) =>
    group.recordings.map((recording) => ({
      ...recording,
      group: {
        id: group.id,
        legacyStudentName: group.legacyStudentName,
        courseTitle: group.legacyModule.course.title,
        moduleTitle: group.legacyModule.title,
      },
      progress: recording.asset.playbackProgress[0] ?? null,
    }))
  );

  return {
    access,
    groups,
    recordings,
    continueWatching: recordings
      .filter(
        (recording) =>
          recording.progress &&
          recording.progress.positionSeconds > 0 &&
          !recording.progress.completedPlaybackAt
      )
      .sort(
        (left, right) =>
          (right.progress?.lastViewedAt.getTime() ?? 0) -
          (left.progress?.lastViewedAt.getTime() ?? 0)
      )
      .slice(0, 6),
  };
};

export const getAdminRecordingGroups = async () =>
  database.importedRecordingGroup.findMany({
    orderBy: [{ memberId: "asc" }, { legacyStudentName: "asc" }],
    select: {
      id: true,
      sourcePlatform: true,
      sourceId: true,
      legacyStudentName: true,
      memberId: true,
      assignedAt: true,
      assignedByMemberId: true,
      legacyStudent: {
        select: { sourceId: true, displayName: true, matchStatus: true },
      },
      legacyModule: {
        select: {
          title: true,
          course: { select: { title: true, slug: true } },
        },
      },
      member: {
        select: {
          id: true,
          displayName: true,
          profile: { select: { username: true, displayName: true } },
        },
      },
      recordings: {
        select: { id: true, assetId: true, asset: { select: { kind: true } } },
      },
      assignments: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          action: true,
          previousMemberId: true,
          memberId: true,
          changedByMemberId: true,
          createdAt: true,
        },
      },
    },
  });

export const getAdminAssignableMembers = async () =>
  database.member.findMany({
    orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      profile: { select: { username: true, displayName: true } },
    },
    take: 500,
  });

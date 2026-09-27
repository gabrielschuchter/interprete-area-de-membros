import "server-only";

import { database, MemberRole, type Prisma } from "@repo/database";
import { getMemberRole } from "./authorization";

const yearPattern = /^\d{4}$/;

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
      thumbnailPath: true,
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
              id: true,
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
              thumbnailPath: true,
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
          thumbnailUrl: importedRecording.thumbnailPath
            ? `/api/learning/recordings/${importedRecording.id}/thumbnail`
            : null,
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
      thumbnailUrl: recording.thumbnailPath
        ? `/api/learning/recordings/${recording.id}/thumbnail`
        : null,
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

export interface RecordingPageOptions {
  readonly cursor?: string;
  readonly query?: string;
  readonly requestedAssetId?: string;
  readonly take?: number;
  readonly year?: string;
}

const recordingPageSelection = (memberId: string) => ({
  id: true,
  originalTitle: true,
  meetingDate: true,
  thumbnailPath: true,
  legacyLesson: { select: { title: true, position: true } },
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
});

/**
 * Archive listing query. It pages recordings rather than loading every
 * imported lesson just to paint the first viewport. Authorization remains on
 * ImportedRecordingGroup.memberId (or staff role) and is applied in SQL.
 */
export const getMemberRecordingPage = async (
  memberId: string,
  options: RecordingPageOptions = {}
) => {
  const access = await getRecordingAccessContext(memberId);
  const take = Math.min(Math.max(options.take ?? 18, 6), 36);
  const query = options.query?.trim();
  const year = options.year?.match(yearPattern)?.[0];
  const where: Prisma.ImportedRecordingWhereInput = {
    group: access.fullAccess ? undefined : { memberId },
    ...(query
      ? {
          OR: [
            { originalTitle: { contains: query, mode: "insensitive" } },
            { asset: { title: { contains: query, mode: "insensitive" } } },
            {
              group: {
                legacyStudentName: { contains: query, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
    ...(year
      ? {
          meetingDate: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lt: new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`),
          },
        }
      : {}),
  };

  const [rows, requested] = await Promise.all([
    database.importedRecording.findMany({
      where,
      orderBy: [{ meetingDate: "desc" }, { id: "desc" }],
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      take: take + 1,
      select: recordingPageSelection(memberId),
    }),
    options.requestedAssetId
      ? database.importedRecording.findFirst({
          where: {
            ...where,
            assetId: options.requestedAssetId,
          },
          select: recordingPageSelection(memberId),
        })
      : Promise.resolve(null),
  ]);

  const hasMore = rows.length > take;
  const visibleRows = hasMore ? rows.slice(0, take) : rows;
  const mapRow = (recording: (typeof visibleRows)[number]) => ({
    ...recording,
    thumbnailUrl: recording.thumbnailPath
      ? `/api/learning/recordings/${recording.id}/thumbnail`
      : null,
    progress: recording.asset.playbackProgress[0] ?? null,
  });

  return {
    access,
    hasMore,
    nextCursor: hasMore ? (visibleRows.at(-1)?.id ?? null) : null,
    recordings: visibleRows.map(mapRow),
    requestedRecording: requested ? mapRow(requested) : null,
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
        select: {
          id: true,
          assetId: true,
          originalTitle: true,
          thumbnailPath: true,
          asset: { select: { id: true, title: true, kind: true } },
        },
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

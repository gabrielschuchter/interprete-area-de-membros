import "server-only";
import { database } from "@repo/database";
import {
  matchesRecordingTab,
  parseRecordingTab,
  type RecordingGroupTab,
} from "./gestao-recordings-domain";

const groupSelect = {
  id: true,
  legacyStudentName: true,
  memberId: true,
  sourceId: true,
  sourcePlatform: true,
  legacyModule: {
    select: { title: true, course: { select: { title: true } } },
  },
  member: { select: { displayName: true } },
  recordings: {
    select: {
      id: true,
      originalTitle: true,
      thumbnailPath: true,
      asset: { select: { kind: true, title: true } },
    },
  },
} as const;

export const getGestaoRecordingGroups = async (input: {
  readonly query?: string;
  readonly tab?: string;
}) => {
  const tab: RecordingGroupTab = parseRecordingTab(input.tab);
  const query = (input.query ?? "").trim().toLowerCase().slice(0, 80);
  const groups = await database.importedRecordingGroup.findMany({
    orderBy: [{ legacyStudentName: "asc" }, { id: "asc" }],
    take: 800,
    select: groupSelect,
  });
  const rows = groups.map((group) => {
    const videos = group.recordings.filter(
      ({ asset }) => asset.kind === "VIDEO"
    ).length;
    return {
      ...group,
      attachments: group.recordings.length - videos,
      linked: group.memberId !== null,
      videos,
    };
  });
  const pending = rows.filter((row) => !row.linked).length;
  const visible = rows.filter(
    (row) =>
      matchesRecordingTab(tab, row.linked) &&
      (!query || row.legacyStudentName.toLowerCase().includes(query))
  );
  return { pending, query, tab, total: rows.length, visible };
};

export const getGestaoRecordingHistory = (groupId: string) =>
  database.importedRecordingGroupAssignment.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      action: true,
      createdAt: true,
      id: true,
      member: { select: { displayName: true } },
      note: true,
    },
  });

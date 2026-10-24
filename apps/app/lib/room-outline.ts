import type { VideoAvailability } from "./room-player-state";

// The lessons panel ("Aulas"). Pure so counters and row states stay testable.

export interface RoomOutlineLessonInput {
  readonly completed: boolean;
  readonly durationSeconds: number | null;
  readonly href: string;
  readonly id: string;
  // Replaces the ordinal on the thumbnail (recordings show their date).
  readonly label?: string | null;
  readonly positionSeconds: number;
  readonly releasesAt: Date | null;
  readonly title: string;
  readonly videoAvailability: VideoAvailability | null;
}

export interface RoomOutlineModuleInput {
  readonly id: string;
  readonly lessons: readonly RoomOutlineLessonInput[];
  readonly title: string;
}

export type RoomOutlineItemStatus =
  | "locked"
  | "current"
  | "unavailable"
  | "no_video"
  | "default";

export interface RoomOutlineItem {
  readonly completed: boolean;
  readonly durationMinutes: number | null;
  readonly href: string | null;
  readonly id: string;
  readonly inProgressPercent: number | null;
  readonly isCurrent: boolean;
  readonly label: string | null;
  readonly locked: boolean;
  readonly ordinal: number;
  readonly releasesAt: Date | null;
  readonly status: RoomOutlineItemStatus;
  readonly title: string;
}

export interface RoomOutlineGroup {
  readonly completedCount: number;
  readonly defaultOpen: boolean;
  readonly id: string;
  readonly items: readonly RoomOutlineItem[];
  readonly title: string;
  readonly totalCount: number;
}

export interface RoomOutline {
  readonly completedCount: number;
  readonly currentGroupId: string | null;
  readonly groups: readonly RoomOutlineGroup[];
  readonly totalCount: number;
}

const itemStatus = (
  lesson: RoomOutlineLessonInput,
  locked: boolean,
  isCurrent: boolean
): RoomOutlineItemStatus => {
  if (locked) {
    return "locked";
  }
  if (isCurrent) {
    return "current";
  }
  if (lesson.videoAvailability === "broken") {
    return "unavailable";
  }
  if (lesson.videoAvailability === "missing") {
    return "no_video";
  }
  return "default";
};

export const inProgressPercent = (
  completed: boolean,
  positionSeconds: number,
  durationSeconds: number | null
) =>
  !completed && positionSeconds > 0 && durationSeconds && durationSeconds > 0
    ? Math.min(100, Math.round((positionSeconds / durationSeconds) * 100))
    : null;

export const buildRoomOutline = ({
  currentLessonId,
  modules,
  now,
}: {
  readonly currentLessonId: string;
  readonly modules: readonly RoomOutlineModuleInput[];
  readonly now: Date;
}): RoomOutline => {
  let ordinal = 0;
  let currentGroupId: string | null = null;

  const groups = modules.map((module): RoomOutlineGroup => {
    const items = module.lessons.map((lesson): RoomOutlineItem => {
      ordinal += 1;
      const locked =
        lesson.releasesAt !== null &&
        lesson.releasesAt.getTime() > now.getTime();
      const isCurrent = lesson.id === currentLessonId;
      if (isCurrent) {
        currentGroupId = module.id;
      }
      return {
        completed: lesson.completed,
        durationMinutes: lesson.durationSeconds
          ? Math.max(1, Math.round(lesson.durationSeconds / 60))
          : null,
        href: locked ? null : lesson.href,
        id: lesson.id,
        inProgressPercent: inProgressPercent(
          lesson.completed,
          lesson.positionSeconds,
          lesson.durationSeconds
        ),
        isCurrent,
        label: lesson.label ?? null,
        locked,
        ordinal,
        releasesAt: lesson.releasesAt,
        status: itemStatus(lesson, locked, isCurrent),
        title: lesson.title,
      };
    });
    const completedCount = items.filter(({ completed }) => completed).length;

    return {
      completedCount,
      defaultOpen:
        items.some(({ isCurrent }) => isCurrent) ||
        completedCount < items.length,
      id: module.id,
      items,
      title: module.title,
      totalCount: items.length,
    };
  });

  return {
    completedCount: groups.reduce(
      (total, group) => total + group.completedCount,
      0
    ),
    currentGroupId,
    groups,
    totalCount: groups.reduce((total, group) => total + group.totalCount, 0),
  };
};

// Optimistic counters after a checkbox change, before the server answers.
export const withLessonCompleted = (
  outline: RoomOutline,
  lessonId: string,
  completed: boolean
): RoomOutline => {
  const groups = outline.groups.map((group) => {
    if (!group.items.some(({ id }) => id === lessonId)) {
      return group;
    }
    const items = group.items.map((item) =>
      item.id === lessonId
        ? {
            ...item,
            completed,
            inProgressPercent: completed ? null : item.inProgressPercent,
          }
        : item
    );
    return {
      ...group,
      completedCount: items.filter((item) => item.completed).length,
      items,
    };
  });

  return {
    ...outline,
    completedCount: groups.reduce(
      (total, group) => total + group.completedCount,
      0
    ),
    groups,
  };
};

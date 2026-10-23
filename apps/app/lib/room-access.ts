import {
  hasCourseAccess,
  hasLessonAccess,
  type LearningAccessScope,
} from "./content-access";

export type RoomLessonAccess = "open" | "locked" | "forbidden";

interface RoomLessonRef {
  readonly courseId: string;
  readonly lessonId: string;
  readonly moduleId: string;
}

// hasLessonAccess folds "not released yet" into "no access". The room shows
// a locked lesson to members who will get it, and 403 to everyone else.
export const classifyRoomLessonAccess = (
  scope: LearningAccessScope,
  { courseId, lessonId, moduleId }: RoomLessonRef
): RoomLessonAccess => {
  if (!hasCourseAccess(scope, courseId)) {
    return "forbidden";
  }
  if (hasLessonAccess(scope, courseId, moduleId, lessonId)) {
    return "open";
  }
  const grantedOnceReleased =
    scope.fullCourseIds.has(courseId) ||
    scope.moduleIds.has(moduleId) ||
    scope.lessonIds.has(lessonId);

  return grantedOnceReleased &&
    (scope.unavailableLessonIds?.has(lessonId) ?? false)
    ? "locked"
    : "forbidden";
};

export const roomLessonUnlockDate = (
  scope: LearningAccessScope,
  lessonId: string
) => scope.lessonUnlockDates?.get(lessonId) ?? null;

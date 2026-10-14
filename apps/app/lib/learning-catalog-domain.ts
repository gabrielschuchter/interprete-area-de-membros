interface LearningAssignmentCourseTarget {
  readonly availableAt: Date | null;
  readonly target: {
    readonly id: string;
    readonly type: string;
  };
}

export const getDirectlyAssignedCourseIds = (
  assignments: readonly LearningAssignmentCourseTarget[],
  at: Date
) =>
  new Set(
    assignments
      .filter(
        ({ availableAt, target }) =>
          target.type === "COURSE" && (!availableAt || availableAt <= at)
      )
      .map(({ target }) => target.id)
  );

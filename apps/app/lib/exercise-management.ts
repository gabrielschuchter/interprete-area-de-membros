export const exerciseManagementPath = (
  gestaoReturn: boolean,
  listId?: string
) => {
  const root = gestaoReturn ? "/gestao/ensino/exercicios" : "/admin/exercicios";
  return listId ? `${root}/${encodeURIComponent(listId)}` : root;
};

export interface ExerciseListPosition {
  readonly id: string;
  readonly position: number;
}

export const resolveExerciseQuestionSwap = <T extends ExerciseListPosition>(
  items: readonly T[],
  itemId: string,
  direction: "UP" | "DOWN",
  temporaryPosition?: number
) => {
  const orderedItems = [...items].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id)
  );
  const index = orderedItems.findIndex((item) => item.id === itemId);
  const neighborIndex = index + (direction === "UP" ? -1 : 1);
  if (index < 0 || neighborIndex < 0 || neighborIndex >= orderedItems.length) {
    return null;
  }
  const current = orderedItems[index];
  const neighbor = orderedItems[neighborIndex];
  return {
    current,
    neighbor,
    temporaryPosition:
      temporaryPosition ??
      orderedItems.reduce(
        (highest, item) => Math.max(highest, item.position),
        -1
      ) + 1,
  };
};

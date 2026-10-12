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

export const exerciseBankListsPath = (bankId: string) =>
  `/gestao/ensino/exercicios/bancos/${encodeURIComponent(bankId)}`;

export const exerciseBankListPageSize = 20;

export const exerciseBankListsHref = (input: {
  readonly bankId: string;
  readonly page?: number;
  readonly query?: string;
  readonly status?: string;
}) => {
  const params = new URLSearchParams();
  if (input.query) {
    params.set("q", input.query);
  }
  if (input.status && input.status !== "ALL") {
    params.set("estado", input.status);
  }
  if (input.page && input.page > 1) {
    params.set("pagina", String(input.page));
  }
  const search = params.toString();
  return `${exerciseBankListsPath(input.bankId)}${search ? `?${search}` : ""}`;
};

export const resolveExercisePage = (
  requestedPage: unknown,
  totalCount: number,
  pageSize: number
) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requested = Number(requestedPage);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, totalPages)
      : 1;
  return { page, totalPages };
};

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

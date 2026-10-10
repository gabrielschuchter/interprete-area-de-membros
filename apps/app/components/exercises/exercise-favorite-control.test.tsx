import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExerciseFavoriteStatus: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  undoExerciseFavorite: vi.fn(),
  updateExerciseFavorite: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/app/(authenticated)/exercicios/actions", () => ({
  getExerciseFavoriteStatus: mocks.getExerciseFavoriteStatus,
  undoExerciseFavorite: mocks.undoExerciseFavorite,
  updateExerciseFavorite: mocks.updateExerciseFavorite,
}));

import { getToastSnapshot, toast } from "@repo/design-system/lib/toast";
import { ExerciseFavoriteControl } from "./exercise-favorite-control";

afterEach(() => {
  cleanup();
  for (const record of getToastSnapshot()) {
    toast.dismiss(record.id);
  }
  vi.clearAllMocks();
});

test("updates optimistically and undoes the persisted favorite", async () => {
  const createdAt = "2026-10-09T12:00:00.000Z";
  mocks.updateExerciseFavorite.mockResolvedValue({
    ok: true,
    bookmarked: true,
    operation: "saved",
    createdAt,
  });
  mocks.undoExerciseFavorite.mockResolvedValue({ ok: true, bookmarked: false });

  render(
    <ExerciseFavoriteControl
      initialBookmarked={false}
      questionId="question-1"
    />
  );
  const control = screen.getByRole("button", { name: "Salvar questão" });
  fireEvent.click(control);

  await waitFor(() =>
    expect(mocks.updateExerciseFavorite).toHaveBeenCalledWith({
      desired: true,
      questionId: "question-1",
      sessionId: undefined,
    })
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Remover dos favoritos" })
        .getAttribute("aria-pressed")
    ).toBe("true")
  );
  const record = getToastSnapshot().at(-1);
  expect(record?.message).toBe("Questão salva.");
  expect(record?.variant).toBe("exercise");
  expect(record?.actions?.map((action) => action.label)).toEqual([
    "Ver salvas",
    "Desfazer",
  ]);

  record?.actions?.find((action) => action.label === "Ver salvas")?.onSelect();
  expect(mocks.push).toHaveBeenCalledWith("/exercicios/favoritas");
  record?.actions?.find((action) => action.label === "Desfazer")?.onSelect();
  await waitFor(() =>
    expect(mocks.undoExerciseFavorite).toHaveBeenCalledWith({
      createdAt,
      operation: "saved",
      questionId: "question-1",
    })
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Salvar questão" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  );
  expect(mocks.refresh).toHaveBeenCalled();
});

test("restores the persisted state when undo is rejected", async () => {
  const createdAt = "2026-10-09T12:00:00.000Z";
  mocks.updateExerciseFavorite.mockResolvedValue({
    ok: true,
    bookmarked: true,
    operation: "saved",
    createdAt,
  });
  mocks.undoExerciseFavorite.mockResolvedValue({
    ok: false,
    bookmarked: true,
  });

  render(
    <ExerciseFavoriteControl
      initialBookmarked={false}
      questionId="question-1"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Salvar questão" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Remover dos favoritos" })
    ).toBeTruthy()
  );
  const undoToast = getToastSnapshot().find((record) =>
    record.actions?.some((action) => action.label === "Desfazer")
  );

  await act(async () => {
    undoToast?.actions
      ?.find((action) => action.label === "Desfazer")
      ?.onSelect();
    await Promise.resolve();
  });

  expect(
    screen
      .getByRole("button", { name: "Remover dos favoritos" })
      .getAttribute("aria-pressed")
  ).toBe("true");
  expect(getToastSnapshot().at(-1)?.message).toBe(
    "Não foi possível desfazer esta alteração."
  );
});

test("rolls back the optimistic favorite state when persistence fails", async () => {
  mocks.updateExerciseFavorite.mockResolvedValue({
    ok: false,
    bookmarked: false,
  });
  render(
    <ExerciseFavoriteControl
      initialBookmarked={false}
      questionId="question-1"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Salvar questão" }));

  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Salvar questão" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  );
  expect(getToastSnapshot().at(-1)?.message).toContain(
    "Não foi possível atualizar"
  );
});

test("keeps toggles serialized while undo is still persisting", async () => {
  const createdAt = "2026-10-09T12:00:00.000Z";
  mocks.updateExerciseFavorite.mockResolvedValue({
    ok: true,
    bookmarked: true,
    operation: "saved",
    createdAt,
  });
  let resolveUndo:
    | ((value: { ok: boolean; bookmarked: boolean }) => void)
    | null = null;
  const undoResult = new Promise<{ ok: boolean; bookmarked: boolean }>(
    (resolve) => {
      resolveUndo = resolve;
    }
  );
  mocks.undoExerciseFavorite.mockReturnValue(undoResult);

  render(
    <ExerciseFavoriteControl
      initialBookmarked={false}
      questionId="question-1"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Salvar questão" }));
  await waitFor(() =>
    expect(mocks.updateExerciseFavorite).toHaveBeenCalledTimes(1)
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Remover dos favoritos" })
    ).toBeTruthy()
  );
  const record = getToastSnapshot().find(
    (candidate) =>
      candidate.message === "Questão salva." &&
      candidate.actions?.some((action) => action.label === "Desfazer")
  );
  expect(record).toBeTruthy();
  await act(async () => {
    record?.actions?.find((action) => action.label === "Desfazer")?.onSelect();
    await Promise.resolve();
  });

  await waitFor(() =>
    expect(mocks.undoExerciseFavorite).toHaveBeenCalledTimes(1)
  );
  const toggle = screen.getByRole("button", { name: "Salvar questão" });
  expect(toggle.hasAttribute("disabled")).toBe(true);
  fireEvent.click(toggle);
  expect(mocks.updateExerciseFavorite).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveUndo?.({ ok: true, bookmarked: false });
    await undoResult;
  });
  await waitFor(() => expect(toggle.hasAttribute("disabled")).toBe(false));
  expect(mocks.undoExerciseFavorite).toHaveBeenCalledTimes(1);
});

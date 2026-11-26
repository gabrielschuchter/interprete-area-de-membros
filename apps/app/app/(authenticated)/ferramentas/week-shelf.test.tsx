import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { buildShelfDays } from "@/lib/study-week-shelf-model";

const CUMPRIDA = /cumprida/;
const LANCAR_30 = /Lançar 30 min/;
const DESFAZER = /Desfazer/;

const refresh = vi.fn();
const addAction = vi.fn(() => Promise.resolve({ id: "x" }));
const deleteAction = vi.fn(() => Promise.resolve({ id: "x" }));
const goalAction = vi.fn(() => Promise.resolve({}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@repo/design-system/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./study-manual-actions", () => ({
  addManualStudyEntryAction: addAction,
  deleteManualStudyEntryAction: deleteAction,
}));
vi.mock("./planner-actions", () => ({ savePlannerGoalAction: goalAction }));

const { WeekShelf } = await import("./week-shelf");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const days = buildShelfDays(
  [{ dayKey: "2026-11-23", group: "lesson", seconds: 3600 }],
  "2026-11-23",
  "2026-11-26"
);

const baseProps = {
  days,
  manualEntries: [],
  studiedMinutes: 60,
  targetMinutes: 300,
  weekStartKey: "2026-11-23",
};

test("mostra quanto falta para a meta sem carimbo enquanto não bate", () => {
  render(<WeekShelf {...baseProps} />);
  expect(screen.getByText("Faltam 240 min")).toBeTruthy();
  expect(screen.queryByText(CUMPRIDA)).toBeNull();
});

test("carimba a meta cumprida quando o estudo alcança o alvo", () => {
  render(<WeekShelf {...baseProps} studiedMinutes={300} />);
  expect(screen.getByText("Meta batida")).toBeTruthy();
  expect(screen.getByText(CUMPRIDA)).toBeTruthy();
});

test("sem meta, convida a definir uma e não quebra a ampulheta", () => {
  render(<WeekShelf {...baseProps} targetMinutes={null} />);
  expect(screen.getByText("Defina sua meta")).toBeTruthy();
});

test("lança o tempo manual escolhido e desfaz o último lançamento", () => {
  render(
    <WeekShelf
      {...baseProps}
      manualEntries={[
        { id: "s1", group: "reading", minutes: 15, at: "2026-11-26T13:00:00Z" },
      ]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Exercícios" }));
  fireEvent.click(screen.getByRole("button", { name: "30 min" }));
  fireEvent.click(screen.getByRole("button", { name: LANCAR_30 }));
  expect(addAction).toHaveBeenCalledWith({ group: "exercise", minutes: 30 });
  fireEvent.click(screen.getByRole("button", { name: DESFAZER }));
  expect(deleteAction).toHaveBeenCalledWith("s1");
});

test("a fita de meta salva a meta semanal", () => {
  render(<WeekShelf {...baseProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Meta de 420 minutos" }));
  expect(goalAction).toHaveBeenCalledWith({
    period: "WEEKLY",
    targetMinutes: 420,
  });
});

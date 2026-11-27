import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { buildShelfDays } from "@/lib/study-week-shelf-model";

const CUMPRIDA = /cumprida/;
const LANCAR_30 = /Lançar 30 min/;
const FORA = /Estudou fora da plataforma/;
const TIPO_ESTUDO = /Tipo de estudo/;
const RESUMO = /Esta semana: 1 aula · 10 questões/;
const TIPO = /Tipo de meta/;

// O build da Vercel roda a suíte inteira em máquina lenta: dá folga ao render.
vi.setConfig({ testTimeout: 30_000 });

const refresh = vi.fn();
const addAction = vi.fn(() => Promise.resolve({ id: "x" }));
const deleteAction = vi.fn(() => Promise.resolve({ id: "x" }));
const goalAction = vi.fn(() => Promise.resolve({}));
const countSave = vi.fn(() => Promise.resolve({}));
const countDelete = vi.fn(() => Promise.resolve());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@repo/design-system/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./study-manual-actions", () => ({
  addManualStudyEntryAction: addAction,
  deleteManualStudyEntryAction: deleteAction,
}));
vi.mock("./count-goal-actions", () => ({
  deleteCountGoalAction: countDelete,
  saveCountGoalAction: countSave,
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
  activity: {
    perDay: { "2026-11-23": { LESSONS: 1, READINGS: 0, EXERCISES: 10 } },
    week: { LESSONS: 1, READINGS: 0, EXERCISES: 10 },
  },
  countGoals: {
    LESSONS: { done: 2, target: 5 },
    READINGS: { done: 0, target: null },
    EXERCISES: { done: 12, target: 10 },
  },
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
  expect(screen.queryByRole("button", { name: LANCAR_30 })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: FORA }));
  fireEvent.click(
    within(screen.getByRole("group", { name: TIPO_ESTUDO })).getByRole(
      "button",
      { name: "Exercícios" }
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "30 min" }));
  fireEvent.click(screen.getByRole("button", { name: LANCAR_30 }));
  expect(addAction).toHaveBeenCalledWith({ group: "exercise", minutes: 30 });
  fireEvent.click(
    screen.getByRole("button", { name: "Remover lançamento de 15 minutos" })
  );
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

test("troca o tipo da meta para aulas e mostra o progresso por quantidade", () => {
  render(<WeekShelf {...baseProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Aulas" }));
  expect(screen.getByText("Faltam 3 aulas")).toBeTruthy();
  expect(screen.getByText("2 / 5 aulas")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Meta de 8 aulas" }));
  expect(countSave).toHaveBeenCalledWith({ kind: "LESSONS", target: 8 });
  expect(goalAction).not.toHaveBeenCalled();
});

test("meta de exercícios batida mostra meta batida e permite remover a meta", () => {
  render(<WeekShelf {...baseProps} />);
  fireEvent.click(
    within(screen.getByRole("group", { name: TIPO })).getByRole("button", {
      name: "Exercícios",
    })
  );
  expect(screen.getByText("Meta batida")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remover esta meta" }));
  expect(countDelete).toHaveBeenCalledWith("EXERCISES");
});

test("valor personalizado salva a meta do tipo escolhido", () => {
  render(<WeekShelf {...baseProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Leituras" }));
  expect(screen.getByText("Defina sua meta")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Outro valor para a meta"), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(countSave).toHaveBeenCalledWith({ kind: "READINGS", target: 7 });
});

test("mantém o resumo da semana e mostra o detalhe do tipo ao passar o mouse", () => {
  render(<WeekShelf {...baseProps} />);
  expect(screen.getByText(RESUMO)).toBeTruthy();
  // Sem legenda fixa: o detalhe só aparece sob demanda.
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.mouseEnter(
    screen.getByRole("button", { name: "Aula · 60 min, 1 aula concluída" })
  );
  expect(screen.getByRole("status").textContent).toContain("Aula · 60 min");
  expect(screen.getByRole("status").textContent).toContain("1 aula concluída");
  fireEvent.mouseLeave(
    screen.getByRole("button", { name: "Aula · 60 min, 1 aula concluída" })
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("itens feitos sem tempo registrado viram um livro vazado com o detalhe", () => {
  render(<WeekShelf {...baseProps} />);
  const book = screen.getByRole("button", {
    name: "Exercícios · menos de 1 min, 10 questões respondidas",
  });
  fireEvent.click(book);
  expect(screen.getByRole("status").textContent).toContain(
    "10 questões respondidas"
  );
});

test("as barras não disparam a dica global (só o detalhe próprio)", () => {
  render(<WeekShelf {...baseProps} />);
  const book = screen.getByRole("button", {
    name: "Aula · 60 min, 1 aula concluída",
  });
  expect(book.hasAttribute("data-tooltip-off")).toBe(true);
});

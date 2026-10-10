import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import {
  ExerciseSessionDraftProvider,
  useExerciseSessionDrafts,
} from "./exercise-session-drafts";

const DraftProbe = () => {
  const { clearDrafts, draftFor, hasSelections, requestExit, setDraftFor } =
    useExerciseSessionDrafts();
  const [currentQuestionId, setCurrentQuestionId] = useState("question-a");
  return (
    <div>
      <output aria-label="rascunho">
        {draftFor(currentQuestionId).join(",")}
      </output>
      <output aria-label="seleção pendente">{String(hasSelections)}</output>
      <button
        onClick={() =>
          setDraftFor(currentQuestionId, [
            currentQuestionId === "question-a" ? "option-a" : "option-b",
          ])
        }
        type="button"
      >
        Selecionar
      </button>
      <button
        onClick={() =>
          setCurrentQuestionId((current) =>
            current === "question-a" ? "question-b" : "question-a"
          )
        }
        type="button"
      >
        Trocar questão
      </button>
      <button onClick={clearDrafts} type="button">
        Sair
      </button>
      <button onClick={() => requestExit("/exercicios")} type="button">
        Sair sem rascunho
      </button>
      <a href="/exercicios">Sair pelo menu</a>
    </div>
  );
};

const renderDraftProbe = () =>
  render(
    <ExerciseSessionDraftProvider storageKey="session-a">
      <DraftProbe />
    </ExerciseSessionDraftProvider>
  );

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

test("restores an unsubmitted choice for the same session and clears it on confirmed exit", async () => {
  const first = renderDraftProbe();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));

  await waitFor(() => {
    expect(screen.getByLabelText("rascunho").textContent).toBe("option-a");
    expect(
      window.sessionStorage.getItem("exercise-drafts:session-a")
    ).toContain("option-a");
  });

  first.unmount();
  renderDraftProbe();
  await waitFor(() =>
    expect(screen.getByLabelText("rascunho").textContent).toBe("option-a")
  );
  expect(screen.getByLabelText("seleção pendente").textContent).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(window.sessionStorage.getItem("exercise-drafts:session-a")).toBeNull();
  await waitFor(() =>
    expect(screen.getByLabelText("seleção pendente").textContent).toBe("false")
  );
});

test("confirms navigation away only while a draft would be discarded", async () => {
  renderDraftProbe();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
  await waitFor(() =>
    expect(screen.getByLabelText("seleção pendente").textContent).toBe("true")
  );

  fireEvent.click(screen.getByRole("link", { name: "Sair pelo menu" }));
  const exitDialog = screen.getByRole("alertdialog");
  expect(exitDialog.querySelector('[data-slot="dialog-close"]')).toBeNull();
  expect(exitDialog.textContent).toContain(
    "As seleções ainda não confirmadas serão descartadas ao sair."
  );
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar sessão" }));
  expect(screen.getByLabelText("rascunho").textContent).toBe("option-a");
  expect(mocks.push).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("link", { name: "Sair pelo menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair da sessão" }));
  expect(mocks.push).toHaveBeenCalledWith("/exercicios");
  expect(window.sessionStorage.getItem("exercise-drafts:session-a")).toBeNull();
});

test("leaves directly when there are no unconfirmed selections", () => {
  renderDraftProbe();

  fireEvent.click(screen.getByRole("button", { name: "Sair sem rascunho" }));

  expect(mocks.push).toHaveBeenCalledWith("/exercicios");
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("keeps independent selections while navigating between pending questions", async () => {
  renderDraftProbe();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
  expect(screen.getByLabelText("rascunho").textContent).toBe("option-a");

  fireEvent.click(screen.getByRole("button", { name: "Trocar questão" }));
  expect(screen.getByLabelText("rascunho").textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
  expect(screen.getByLabelText("rascunho").textContent).toBe("option-b");

  fireEvent.click(screen.getByRole("button", { name: "Trocar questão" }));
  expect(screen.getByLabelText("rascunho").textContent).toBe("option-a");
  fireEvent.click(screen.getByRole("button", { name: "Trocar questão" }));
  expect(screen.getByLabelText("rascunho").textContent).toBe("option-b");

  await waitFor(() =>
    expect(
      JSON.parse(
        window.sessionStorage.getItem("exercise-drafts:session-a") ?? "{}"
      )
    ).toEqual({
      "question-a": ["option-a"],
      "question-b": ["option-b"],
    })
  );
});

test("keeps keyboard focus inside the exit dialog and restores it on Escape", async () => {
  renderDraftProbe();
  const exitLink = screen.getByRole("link", { name: "Sair pelo menu" });
  fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
  await waitFor(() =>
    expect(screen.getByLabelText("seleção pendente").textContent).toBe("true")
  );

  fireEvent.click(exitLink);
  const exitDialog = screen.getByRole("alertdialog");
  await waitFor(() =>
    expect(exitDialog.contains(document.activeElement)).toBe(true)
  );
  fireEvent.keyDown(exitDialog, { key: "Escape", code: "Escape" });

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(exitLink));
  expect(screen.getByLabelText("rascunho").textContent).toBe("option-a");
  expect(mocks.push).not.toHaveBeenCalled();
});

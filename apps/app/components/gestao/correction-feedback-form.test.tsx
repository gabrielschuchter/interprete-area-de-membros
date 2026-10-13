import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ButtonHTMLAttributes } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CorrectionActionState } from "@/lib/gestao-correction-contract";

const mocks = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/gestao-correction-actions", () => ({
  saveGestaoCorrection: mocks.save,
}));
vi.mock("@/components/mutations/single-flight-form", () => ({
  SingleFlightSubmit: ({
    children,
    pendingLabel,
    variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    pendingLabel?: string;
    variant?: string;
  }) => (
    <button {...props} type="submit">
      {children}
    </button>
  ),
}));

import { CorrectionFeedbackForm } from "./correction-feedback-form";

const properties = {
  content: "saved first",
  criteria: [{ id: "criterion", title: "Critério", weight: 100 }],
  draftCurrent: true,
  draftVersion: 1,
  feedbackVersion: 0,
  initialScores: { criterion: 7 },
  returnTo: "/gestao/alunos/correcoes",
  submissionId: "first",
  submittedAt: "2026-10-13T10:00:00Z",
  submissionUpdatedAt: "2026-10-13T10:00:00Z",
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
test("switching submission clears prior recipient's text and scores", () => {
  const view = render(<CorrectionFeedbackForm {...properties} />);
  fireEvent.change(screen.getByLabelText("Comentário ao aluno"), {
    target: { value: "unsent first" },
  });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "9" },
  });
  view.rerender(
    <CorrectionFeedbackForm
      {...properties}
      content=""
      initialScores={{}}
      submissionId="second"
    />
  );
  expect(
    (screen.getByLabelText("Comentário ao aluno") as HTMLTextAreaElement).value
  ).toBe("");
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
});
test("persisted draft version does not remount unsent fields", () => {
  const view = render(<CorrectionFeedbackForm {...properties} />);
  fireEvent.change(screen.getByLabelText("Comentário ao aluno"), {
    target: { value: "current text" },
  });
  view.rerender(<CorrectionFeedbackForm {...properties} draftVersion={2} />);
  expect(
    (screen.getByLabelText("Comentário ao aluno") as HTMLTextAreaElement).value
  ).toBe("current text");
});
test("navigation survives server props changing recipient before action resolves", async () => {
  let complete: ((result: CorrectionActionState) => void) | undefined;
  mocks.save.mockImplementation(
    () =>
      new Promise<CorrectionActionState>((resolve) => {
        complete = resolve;
      })
  );
  const view = render(<CorrectionFeedbackForm {...properties} />);
  const form = screen.getByLabelText("Comentário ao aluno").closest("form");
  if (!form) {
    throw new Error("Expected feedback form");
  }
  fireEvent.submit(form);
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  view.rerender(
    <CorrectionFeedbackForm
      {...properties}
      content=""
      initialScores={{}}
      submissionId="second"
    />
  );
  if (!complete) {
    throw new Error("Expected pending action");
  }
  const resolve = complete;
  await act(async () =>
    resolve({
      status: "success",
      code: "feedback-enviado",
      href: "/gestao/alunos/correcoes?entrega=second",
    })
  );
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenCalledWith(
      "/gestao/alunos/correcoes?entrega=second"
    )
  );
  expect(
    (screen.getByLabelText("Comentário ao aluno") as HTMLTextAreaElement).value
  ).toBe("");
});

test("validation error preserves the typed comment instead of restoring the saved draft", async () => {
  mocks.save.mockResolvedValue({
    status: "error",
    code: "scores-required",
    fieldErrors: { scores: "Revise as notas da rubrica antes de enviar." },
  });
  render(<CorrectionFeedbackForm {...properties} />);
  const comment = screen.getByLabelText("Comentário ao aluno");
  fireEvent.change(comment, {
    target: { value: "new comment must survive validation" },
  });
  const form = comment.closest("form");
  if (!form) {
    throw new Error("Expected feedback form");
  }
  fireEvent.submit(form);
  await screen.findByText("Revise as notas da rubrica antes de enviar.");
  expect((comment as HTMLTextAreaElement).value).toBe(
    "new comment must survive validation"
  );
});

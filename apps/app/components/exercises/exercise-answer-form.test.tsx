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
  push: vi.fn(),
  submitExerciseAnswer: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/app/(authenticated)/exercicios/actions", () => ({
  submitExerciseAnswer: mocks.submitExerciseAnswer,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    readonly children: React.ReactNode;
    readonly href: string;
  }) => <a href={href}>{children}</a>,
}));

import { ExerciseAnswerForm } from "./exercise-answer-form";
import {
  ExerciseSessionDraftProvider,
  useExerciseSessionDrafts,
} from "./exercise-session-drafts";

const question = (id: string) => ({
  id,
  questionVersion: {
    options: [
      { content: "Alternativa correta", id: `${id}-option-a`, label: "A" },
      { content: "Alternativa incorreta", id: `${id}-option-b`, label: "B" },
    ],
    type: "SINGLE_CHOICE",
  },
});

const session = {
  id: "session-1",
  questions: [{ id: "question-a" }, { id: "question-b" }],
};
const correctOptionName = /Alternativa correta/;

const submitCurrentForm = () => {
  const form = screen
    .getByRole("button", { name: "Confirmar resposta" })
    .closest("form");
  if (!form) {
    throw new Error("Exercise answer form was not found.");
  }
  fireEvent.submit(form);
};

const DraftConnectedForm = ({
  questionId,
}: {
  readonly questionId: string;
}) => {
  const { draftFor, setDraftFor } = useExerciseSessionDrafts();
  return (
    <ExerciseAnswerForm
      draftSelectedOptionIds={draftFor(questionId)}
      initialError={false}
      onDraftChange={setDraftFor}
      question={question(questionId)}
      session={session}
    />
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("does not show one question's confirmed feedback on the next question", async () => {
  mocks.submitExerciseAnswer.mockResolvedValue({
    status: "success",
    feedback: {
      correctOptionLabels: ["A"],
      correctOptionIds: ["question-a-option-a"],
      explanation: "Explicação da primeira questão.",
      isCorrect: true,
      isSessionComplete: false,
      nextHref: "/exercicios/sessoes/session-1?questao=question-b",
      resultHref: "/exercicios/sessoes/session-1/resultado",
      selectedOptionIds: ["question-a-option-a"],
      sessionQuestionId: "question-a",
    },
  });

  const view = render(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      key="question-a"
      onDraftChange={vi.fn()}
      question={question("question-a")}
      session={session}
    />
  );

  fireEvent.click(screen.getByRole("radio", { name: correctOptionName }));
  submitCurrentForm();

  await screen.findByText("Explicação da primeira questão.");
  view.rerender(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      key="question-b"
      onDraftChange={vi.fn()}
      question={question("question-b")}
      session={session}
    />
  );

  await waitFor(() => {
    expect(screen.queryByText("Explicação da primeira questão.")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Confirmar resposta" })
    ).toBeDefined();
  });
});

test("notifies the session workspace once when the answer is persisted", async () => {
  const onAnswerConfirmed = vi.fn();
  mocks.submitExerciseAnswer.mockResolvedValue({
    status: "success",
    feedback: {
      correctOptionLabels: ["A"],
      correctOptionIds: ["question-a-option-a"],
      explanation: "Explicação salva.",
      isCorrect: true,
      isSessionComplete: false,
      nextHref: "/exercicios/sessoes/session-1?questao=question-b",
      resultHref: "/exercicios/sessoes/session-1/resultado",
      selectedOptionIds: ["question-a-option-a"],
      sessionQuestionId: "question-a",
    },
  });

  render(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      onAnswerConfirmed={onAnswerConfirmed}
      onDraftChange={vi.fn()}
      question={question("question-a")}
      session={session}
    />
  );

  fireEvent.click(screen.getByRole("radio", { name: correctOptionName }));
  submitCurrentForm();
  await screen.findByText("Explicação salva.");

  await waitFor(() => expect(onAnswerConfirmed).toHaveBeenCalledTimes(1));
  expect(onAnswerConfirmed).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionQuestionId: "question-a",
      isCorrect: true,
    })
  );
});

test("keeps a late answer result bound to its question after rapid navigation", async () => {
  let resolveSubmit:
    | ((state: {
        status: "success";
        feedback: {
          correctOptionLabels: string[];
          correctOptionIds: string[];
          explanation: string;
          isCorrect: boolean;
          isSessionComplete: boolean;
          nextHref: string;
          resultHref: string;
          selectedOptionIds: string[];
          sessionQuestionId: string;
        };
      }) => void)
    | null = null;
  const answerResult = new Promise<{
    status: "success";
    feedback: {
      correctOptionLabels: string[];
      correctOptionIds: string[];
      explanation: string;
      isCorrect: boolean;
      isSessionComplete: boolean;
      nextHref: string;
      resultHref: string;
      selectedOptionIds: string[];
      sessionQuestionId: string;
    };
  }>((resolve) => {
    resolveSubmit = resolve;
  });
  mocks.submitExerciseAnswer.mockReturnValue(answerResult);

  const view = render(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      key="question-a"
      onDraftChange={vi.fn()}
      question={question("question-a")}
      session={session}
    />
  );

  fireEvent.click(screen.getByRole("radio", { name: correctOptionName }));
  submitCurrentForm();
  await waitFor(() =>
    expect(mocks.submitExerciseAnswer).toHaveBeenCalledTimes(1)
  );

  view.rerender(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      key="question-b"
      onDraftChange={vi.fn()}
      question={question("question-b")}
      session={session}
    />
  );
  expect(
    screen.getByRole("button", { name: "Confirmar resposta" })
  ).toBeDefined();

  await act(async () => {
    resolveSubmit?.({
      status: "success",
      feedback: {
        correctOptionLabels: ["A"],
        correctOptionIds: ["question-a-option-a"],
        explanation: "Explicação atrasada da questão A.",
        isCorrect: true,
        isSessionComplete: false,
        nextHref: "/exercicios/sessoes/session-1?questao=question-b",
        resultHref: "/exercicios/sessoes/session-1/resultado",
        selectedOptionIds: ["question-a-option-a"],
        sessionQuestionId: "question-a",
      },
    });
    await answerResult;
  });

  expect(screen.queryByText("Explicação atrasada da questão A.")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Confirmar resposta" })
  ).toBeDefined();
});

test("does not show a late incorrect answer on the newly opened question", async () => {
  let resolveSubmit:
    | ((state: {
        status: "success";
        feedback: {
          correctOptionLabels: string[];
          correctOptionIds: string[];
          explanation: string;
          isCorrect: boolean;
          isSessionComplete: boolean;
          nextHref: string;
          resultHref: string;
          selectedOptionIds: string[];
          sessionQuestionId: string;
        };
      }) => void)
    | null = null;
  const answerResult = new Promise<{
    status: "success";
    feedback: {
      correctOptionLabels: string[];
      correctOptionIds: string[];
      explanation: string;
      isCorrect: boolean;
      isSessionComplete: boolean;
      nextHref: string;
      resultHref: string;
      selectedOptionIds: string[];
      sessionQuestionId: string;
    };
  }>((resolve) => {
    resolveSubmit = resolve;
  });
  mocks.submitExerciseAnswer.mockReturnValue(answerResult);

  const view = render(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      key="question-a"
      onDraftChange={vi.fn()}
      question={question("question-a")}
      session={session}
    />
  );

  fireEvent.click(screen.getByRole("radio", { name: correctOptionName }));
  submitCurrentForm();
  await waitFor(() =>
    expect(mocks.submitExerciseAnswer).toHaveBeenCalledTimes(1)
  );

  view.rerender(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      key="question-b"
      onDraftChange={vi.fn()}
      question={question("question-b")}
      session={session}
    />
  );

  await act(async () => {
    resolveSubmit?.({
      status: "success",
      feedback: {
        correctOptionLabels: ["B"],
        correctOptionIds: ["question-a-option-b"],
        explanation: "Explicação incorreta da questão A.",
        isCorrect: false,
        isSessionComplete: false,
        nextHref: "/exercicios/sessoes/session-1?questao=question-b",
        resultHref: "/exercicios/sessoes/session-1/resultado",
        selectedOptionIds: ["question-a-option-a"],
        sessionQuestionId: "question-a",
      },
    });
    await answerResult;
  });

  expect(screen.queryByText("Explicação incorreta da questão A.")).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Resposta incorreta" })
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Confirmar resposta" })
  ).toBeDefined();
});

test("retains selected alternatives and allows a retry after a save failure", async () => {
  mocks.submitExerciseAnswer
    .mockResolvedValueOnce({
      status: "error",
      message:
        "Não foi possível confirmar sua resposta. Verifique a conexão e tente novamente.",
      retryable: true,
      sessionQuestionId: "question-a",
    })
    .mockResolvedValueOnce({
      status: "success",
      feedback: {
        correctOptionLabels: ["A"],
        correctOptionIds: ["question-a-option-a"],
        explanation: "Resposta salva.",
        isCorrect: true,
        isSessionComplete: false,
        nextHref: "/exercicios/sessoes/session-1?questao=question-b",
        resultHref: "/exercicios/sessoes/session-1/resultado",
        selectedOptionIds: ["question-a-option-a"],
        sessionQuestionId: "question-a",
      },
    });

  render(
    <ExerciseSessionDraftProvider storageKey="session-retry">
      <DraftConnectedForm questionId="question-a" />
    </ExerciseSessionDraftProvider>
  );

  fireEvent.click(screen.getByRole("radio", { name: correctOptionName }));
  await waitFor(() => {
    expect(
      (
        screen.getByRole("radio", {
          name: correctOptionName,
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
  });
  submitCurrentForm();

  await screen.findByRole("alert");
  expect(
    screen.getByText("Não foi possível confirmar sua resposta.")
  ).toBeDefined();
  expect(
    screen.getByText(
      "Sua seleção foi mantida. Verifique a conexão e tente novamente."
    )
  ).toBeDefined();
  const selectedCount = screen.getByText("1 alternativa selecionada");
  expect(selectedCount.className).toContain("hidden");
  expect(selectedCount.className).toContain("md:block");
  expect(
    (
      screen.getByRole("radio", {
        name: correctOptionName,
      }) as HTMLInputElement
    ).checked
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Resposta salva.");
  expect(mocks.submitExerciseAnswer).toHaveBeenCalledTimes(2);
});

test("keeps the fixed response action on mobile until the 768px breakpoint", () => {
  render(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      onDraftChange={vi.fn()}
      question={question("question-a")}
      session={session}
    />
  );

  const confirmButton = screen.getByRole("button", {
    name: "Confirmar resposta",
  });
  expect(confirmButton.parentElement?.className).toContain("fixed inset-x-0");
  expect(confirmButton.parentElement?.className).toContain("md:static");
  expect(confirmButton.parentElement?.className).not.toContain("sm:static");
});

test("moves the fixed response action above the virtual keyboard and restores it on close", () => {
  const viewport = new EventTarget() as VisualViewport;
  Object.defineProperties(viewport, {
    height: { configurable: true, value: 480, writable: true },
    offsetTop: { configurable: true, value: 0, writable: true },
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });

  const view = render(
    <ExerciseAnswerForm
      draftSelectedOptionIds={[]}
      initialError={false}
      mobileStickyAction
      onDraftChange={vi.fn()}
      question={question("question-a")}
      session={session}
    />
  );

  expect(
    document.documentElement.style.getPropertyValue(
      "--exercise-keyboard-overlap"
    )
  ).toBe(`${window.innerHeight - 480}px`);

  Object.defineProperty(viewport, "height", {
    configurable: true,
    value: 360,
    writable: true,
  });
  viewport.dispatchEvent(new Event("resize"));

  expect(
    document.documentElement.style.getPropertyValue(
      "--exercise-keyboard-overlap"
    )
  ).toBe(`${window.innerHeight - 360}px`);

  view.unmount();
  expect(
    document.documentElement.style.getPropertyValue(
      "--exercise-keyboard-overlap"
    )
  ).toBe("");
});

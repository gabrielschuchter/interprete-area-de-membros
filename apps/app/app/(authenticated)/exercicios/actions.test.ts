import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    exerciseAnswer: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    exerciseSession: { create: vi.fn(), update: vi.fn() },
    exerciseSessionQuestion: { createMany: vi.fn() },
  };
  const database = {
    $transaction: vi.fn(),
    exerciseList: { findFirst: vi.fn() },
    exerciseSessionQuestion: { findFirst: vi.fn() },
  };
  const redirect = vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });

  return {
    database,
    dispatchPendingNotifications: vi.fn(),
    evaluateExerciseAnswer: vi.fn(),
    evaluateMemberBadges: vi.fn(),
    markLearningAssignmentCompleted: vi.fn(),
    markLearningAssignmentStarted: vi.fn(),
    redirect,
    revalidatePath: vi.fn(),
    requireMemberId: vi.fn(),
    transaction,
    validateExerciseDraft: vi.fn(),
  };
});

vi.mock("@repo/database", () => ({
  BadgeCriterion: { EXERCISE_ANSWERS: "EXERCISE_ANSWERS" },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  ExerciseQuestionType: {
    MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
    SINGLE_CHOICE: "SINGLE_CHOICE",
  },
  ExerciseSessionStatus: {
    COMPLETED: "COMPLETED",
    IN_PROGRESS: "IN_PROGRESS",
  },
  LearningAssignmentTargetType: { EXERCISE_LIST: "EXERCISE_LIST" },
  database: mocks.database,
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => Promise<unknown>) =>
    operation(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/authorization", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/badges", () => ({
  evaluateMemberBadges: mocks.evaluateMemberBadges,
}));
vi.mock("@/lib/exercise-engine", () => ({
  evaluateExerciseAnswer: mocks.evaluateExerciseAnswer,
  validateExerciseDraft: mocks.validateExerciseDraft,
}));
vi.mock("@/lib/learning", () => ({ requireMemberId: mocks.requireMemberId }));
vi.mock("@/lib/learning-assignments", () => ({
  markLearningAssignmentCompleted: mocks.markLearningAssignmentCompleted,
  markLearningAssignmentStarted: mocks.markLearningAssignmentStarted,
}));
vi.mock("@/lib/notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: mocks.dispatchPendingNotifications,
}));

import {
  saveExerciseQuestion,
  startExerciseSession,
  submitExerciseAnswer,
} from "./actions";

const exerciseQuestion = {
  id: "session_question_1",
  position: 0,
  answer: null,
  session: {
    id: "session_1",
    listId: "list_1",
    status: "IN_PROGRESS",
    questions: [{ id: "session_question_1", answer: null }],
  },
  questionVersion: {
    explanation: "Explicação confirmada.",
    type: "SINGLE_CHOICE",
    options: [
      {
        id: "option_correct",
        label: "A",
        content: "Correta",
        isCorrect: true,
      },
      {
        id: "option_wrong",
        label: "B",
        content: "Incorreta",
        isCorrect: false,
      },
    ],
  },
};

const formData = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }
  return form;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMemberId.mockResolvedValue("student_1");
  mocks.database.$transaction.mockImplementation(
    async (callback: (transaction: typeof mocks.transaction) => unknown) =>
      callback(mocks.transaction)
  );
  mocks.database.exerciseList.findFirst.mockResolvedValue({
    id: "list_1",
    items: [{ questionVersionId: "question_version_1" }],
  });
  mocks.transaction.exerciseSession.create.mockResolvedValue({
    id: "session_1",
  });
  mocks.transaction.exerciseSessionQuestion.createMany.mockResolvedValue({
    count: 1,
  });
  mocks.database.exerciseSessionQuestion.findFirst.mockResolvedValue(
    exerciseQuestion
  );
  mocks.transaction.exerciseAnswer.findUnique.mockResolvedValue(null);
  mocks.transaction.exerciseAnswer.create.mockResolvedValue({
    id: "answer_1",
  });
  mocks.transaction.exerciseAnswer.count.mockResolvedValue(1);
  mocks.transaction.exerciseSession.update.mockResolvedValue({
    id: "session_1",
  });
  mocks.evaluateExerciseAnswer.mockReturnValue({
    isCorrect: true,
    selectedOptionIds: ["option_correct"],
  });
  mocks.validateExerciseDraft.mockReturnValue({ valid: true, reason: null });
  mocks.markLearningAssignmentStarted.mockResolvedValue({ count: 1 });
  mocks.markLearningAssignmentCompleted.mockResolvedValue({ count: 1 });
  mocks.evaluateMemberBadges.mockResolvedValue([]);
  mocks.dispatchPendingNotifications.mockResolvedValue(undefined);
});

test("keeps invalid question edits on their list without writing a version", async () => {
  mocks.validateExerciseDraft.mockReturnValue({
    valid: false,
    reason: "Múltipla escolha precisa incluir alternativas incorretas.",
  });
  const questionForm = formData({
    listId: "list_1",
    questionId: "question_1",
    statement: "Quais alternativas são corretas?",
    questionType: "MULTIPLE_CHOICE",
    "option-A": "Primeira opção correta",
    "option-B": "Segunda opção correta",
    "option-C": "Uma alternativa incorreta",
    correctOption: "A",
  });
  questionForm.append("correctOption", "B");

  await expect(saveExerciseQuestion(questionForm)).rejects.toThrow(
    "NEXT_REDIRECT:/admin/exercicios/list_1?resultado=invalid"
  );
  expect(mocks.validateExerciseDraft).toHaveBeenCalled();
  expect(mocks.database.$transaction).not.toHaveBeenCalled();
});

test("starting an assigned exercise list updates assignment in the session transaction", async () => {
  await expect(
    startExerciseSession(formData({ listId: "list_1" }))
  ).rejects.toThrow("NEXT_REDIRECT:/exercicios/sessoes/session_1");

  expect(mocks.markLearningAssignmentStarted).toHaveBeenCalledWith(
    "student_1",
    "EXERCISE_LIST",
    "list_1",
    expect.any(Date),
    mocks.transaction
  );
  expect(
    mocks.transaction.exerciseSessionQuestion.createMany
  ).toHaveBeenCalled();
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/aprender");
});

test("completing an assigned exercise list updates assignment in the answer transaction", async () => {
  const answerForm = formData({
    sessionId: "session_1",
    sessionQuestionId: "session_question_1",
  });
  answerForm.append("optionIds", "option_correct");

  await expect(
    submitExerciseAnswer({ status: "idle" }, answerForm)
  ).resolves.toEqual({
    status: "success",
    feedback: {
      correctOptionLabels: ["A"],
      explanation: "Explicação confirmada.",
      isCorrect: true,
      isSessionComplete: true,
      nextHref: null,
      resultHref: "/exercicios/sessoes/session_1?resultado=final",
    },
  });

  expect(mocks.transaction.exerciseSession.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "session_1" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    })
  );
  expect(mocks.markLearningAssignmentCompleted).toHaveBeenCalledWith(
    "student_1",
    "EXERCISE_LIST",
    "list_1",
    expect.any(Date),
    mocks.transaction
  );
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/aprender");
  expect(mocks.dispatchPendingNotifications).toHaveBeenCalledTimes(1);
});

test("returns confirmed feedback inline instead of redirecting the session", async () => {
  mocks.transaction.exerciseAnswer.count.mockResolvedValue(0);
  const answerForm = formData({
    sessionId: "session_1",
    sessionQuestionId: "session_question_1",
  });
  answerForm.append("optionIds", "option_wrong");

  const result = await submitExerciseAnswer({ status: "idle" }, answerForm);

  expect(result).toMatchObject({
    status: "success",
    feedback: {
      isCorrect: true,
      isSessionComplete: false,
      nextHref: "/exercicios/sessoes/session_1?proxima=session_question_1",
    },
  });
  expect(mocks.redirect).not.toHaveBeenCalled();
});

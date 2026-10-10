import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    $queryRaw: vi.fn(),
    exerciseCategory: { upsert: vi.fn() },
    exerciseAnswer: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    exerciseList: { findFirst: vi.fn() },
    exerciseListItem: { update: vi.fn() },
    exerciseQuestion: { findFirst: vi.fn(), update: vi.fn() },
    exerciseQuestionVersion: { create: vi.fn() },
    exerciseSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    exerciseSessionQuestion: { create: vi.fn(), createMany: vi.fn() },
  };
  const database = {
    $transaction: vi.fn(),
    exerciseQuestion: { findFirst: vi.fn() },
    exerciseQuestionBookmark: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
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
    requireStaff: vi.fn(),
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
  ExerciseSessionKind: { FAVORITE: "FAVORITE", LIST: "LIST" },
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
vi.mock("@/lib/authorization", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/badges", () => ({
  evaluateMemberBadges: mocks.evaluateMemberBadges,
}));
vi.mock("@/lib/exercise-engine", () => ({
  evaluateExerciseAnswer: mocks.evaluateExerciseAnswer,
  findMissingExerciseExplanationOptionReferences: vi.fn(() => []),
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
  startExerciseFavoriteSession,
  startExerciseSession,
  submitExerciseAnswer,
  undoExerciseFavorite,
  updateExerciseFavorite,
} from "./actions";

const exerciseQuestion = {
  id: "session_question_1",
  position: 0,
  answer: null,
  session: {
    id: "session_1",
    listId: "list_1",
    kind: "LIST",
    status: "IN_PROGRESS",
    questions: [
      { id: "session_question_1", position: 0, answer: null },
      { id: "session_question_2", position: 1, answer: null },
    ],
  },
  questionVersion: {
    explanation: "Explicação confirmada.",
    type: "SINGLE_CHOICE",
    question: { id: "question_1" },
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
  mocks.requireStaff.mockResolvedValue({
    userId: "teacher_1",
    role: "TEACHER",
  });
  mocks.database.$transaction.mockImplementation(
    async (callback: (transaction: typeof mocks.transaction) => unknown) =>
      callback(mocks.transaction)
  );
  mocks.database.exerciseList.findFirst.mockResolvedValue({
    id: "list_1",
    items: [{ questionVersionId: "question_version_1" }],
  });
  mocks.database.exerciseQuestion.findFirst.mockResolvedValue({
    id: "question_1",
  });
  mocks.database.exerciseQuestionBookmark.findFirst.mockResolvedValue(null);
  mocks.database.exerciseQuestionBookmark.findUnique.mockResolvedValue(null);
  mocks.database.exerciseQuestionBookmark.create.mockResolvedValue({
    id: "bookmark_1",
    createdAt: new Date("2026-10-09T12:00:00.000Z"),
  });
  mocks.database.exerciseQuestionBookmark.deleteMany.mockResolvedValue({
    count: 1,
  });
  mocks.transaction.exerciseSession.create.mockResolvedValue({
    id: "session_1",
  });
  mocks.transaction.exerciseSessionQuestion.createMany.mockResolvedValue({
    count: 1,
  });
  mocks.transaction.exerciseSessionQuestion.create.mockResolvedValue({
    id: "session_question_1",
  });
  mocks.transaction.exerciseSession.findFirst.mockResolvedValue(null);
  mocks.transaction.exerciseList.findFirst.mockResolvedValue({
    id: "list_1",
    items: [{ questionVersionId: "question_version_1" }],
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
  mocks.transaction.exerciseQuestion.findFirst.mockResolvedValue({
    id: "question_1",
    latestVersion: 2,
    listItems: [{ id: "list_item_1" }],
  });
  mocks.transaction.exerciseQuestionVersion.create.mockResolvedValue({
    id: "question_version_3",
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

test("lets a teacher update a question reference in its next immutable version", async () => {
  const explanation =
    "A explicação existente. Referência: Cochrane Handbook, Chapter 8 https://training.cochrane.org/handbook/current/chapter-08";
  mocks.transaction.exerciseList.findFirst.mockResolvedValueOnce({
    id: "list_1",
    bankId: "bank_1",
    status: "PUBLISHED",
    bank: { status: "PUBLISHED" },
    items: [{ id: "list_item_1", questionId: "question_1", position: 0 }],
  });
  const questionForm = formData({
    listId: "list_1",
    questionId: "question_1",
    statement: "Qual alternativa está correta?",
    explanation,
    questionType: "SINGLE_CHOICE",
    "option-A": "Resposta correta",
    "option-B": "Resposta incorreta",
    correctOption: "A",
  });

  await expect(saveExerciseQuestion(questionForm)).rejects.toThrow(
    "NEXT_REDIRECT:/admin/exercicios/list_1?resultado=questao-salva"
  );

  expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
  expect(mocks.transaction.exerciseQuestionVersion.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        questionId: "question_1",
        version: 3,
        explanation,
      }),
    })
  );
  expect(mocks.transaction.exerciseListItem.update).toHaveBeenCalledWith({
    where: { id: "list_item_1" },
    data: { questionVersionId: "question_version_3" },
  });
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
  expect(mocks.transaction.$queryRaw).toHaveBeenCalledTimes(1);
  expect(mocks.transaction.$queryRaw.mock.calls[0]?.[1]).toBe(
    "student_1:list_1"
  );
  expect(mocks.transaction.$queryRaw.mock.calls[0]?.[0]).toEqual(
    expect.arrayContaining([
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("::text AS lock_acquired"),
      expect.stringContaining(", 0)"),
    ])
  );
  expect(
    mocks.transaction.exerciseSessionQuestion.createMany
  ).toHaveBeenCalled();
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/aprender");
});

test("reuses an active attempt for the same member and list", async () => {
  mocks.transaction.exerciseSession.findFirst.mockResolvedValue({
    id: "active_session",
  });

  await expect(
    startExerciseSession(formData({ listId: "list_1" }))
  ).rejects.toThrow("NEXT_REDIRECT:/exercicios/sessoes/active_session");

  expect(mocks.transaction.$queryRaw).toHaveBeenCalledTimes(1);
  expect(mocks.transaction.exerciseSession.create).not.toHaveBeenCalled();
  expect(mocks.transaction.exerciseList.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: "list_1",
        status: "PUBLISHED",
      }),
    })
  );
});

test("does not resume an active attempt once its list is unpublished", async () => {
  mocks.transaction.exerciseList.findFirst.mockResolvedValue(null);
  mocks.transaction.exerciseSession.findFirst.mockResolvedValue({
    id: "active_session",
  });

  await expect(
    startExerciseSession(formData({ listId: "list_1" }))
  ).rejects.toThrow("NEXT_REDIRECT:/exercicios?estado=lista-indisponivel");

  expect(mocks.transaction.exerciseSession.findFirst).not.toHaveBeenCalled();
  expect(mocks.transaction.exerciseSession.create).not.toHaveBeenCalled();
});

test("creates a separately versioned favorite attempt and reuses it under the question lock", async () => {
  mocks.database.exerciseQuestionBookmark.findFirst.mockResolvedValue({
    question: {
      versions: [{ id: "question_version_1" }],
      listItems: [{ list: { id: "list_1" } }],
    },
  });
  mocks.transaction.exerciseSession.findFirst.mockResolvedValue(null);

  await expect(
    startExerciseFavoriteSession(formData({ questionId: "question_1" }))
  ).rejects.toThrow(
    "NEXT_REDIRECT:/exercicios/favoritas/question_1?sessao=session_1"
  );

  expect(mocks.transaction.$queryRaw).toHaveBeenCalledTimes(1);
  expect(mocks.transaction.$queryRaw.mock.calls[0]?.[1]).toBe(
    "student_1:favorite:question_1"
  );
  expect(mocks.transaction.$queryRaw.mock.calls[0]?.[0]).toEqual(
    expect.arrayContaining([
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("::text AS lock_acquired"),
    ])
  );
  expect(mocks.transaction.exerciseSession.create).toHaveBeenCalledWith({
    data: { memberId: "student_1", listId: "list_1", kind: "FAVORITE" },
    select: { id: true },
  });
  expect(mocks.transaction.exerciseSessionQuestion.create).toHaveBeenCalledWith(
    {
      data: {
        sessionId: "session_1",
        questionVersionId: "question_version_1",
        position: 0,
      },
    }
  );

  mocks.transaction.exerciseSession.findFirst.mockResolvedValue({
    id: "favorite_active_session",
  });
  await expect(
    startExerciseFavoriteSession(formData({ questionId: "question_1" }))
  ).rejects.toThrow(
    "NEXT_REDIRECT:/exercicios/favoritas/question_1?sessao=favorite_active_session"
  );
  expect(mocks.transaction.exerciseSession.create).toHaveBeenCalledTimes(1);
});

test("undo restores only the member's persisted favorite state", async () => {
  const createdAt = new Date("2026-10-09T12:00:00.000Z");
  mocks.database.exerciseQuestionBookmark.findUnique.mockResolvedValueOnce(
    null
  );
  mocks.database.exerciseQuestionBookmark.create.mockResolvedValueOnce({
    createdAt,
  });

  const saved = await updateExerciseFavorite({
    desired: true,
    questionId: "question_1",
  });
  expect(saved).toEqual({
    ok: true,
    bookmarked: true,
    operation: "saved",
    createdAt: createdAt.toISOString(),
  });

  mocks.database.exerciseQuestionBookmark.deleteMany.mockResolvedValueOnce({
    count: 1,
  });
  await expect(
    undoExerciseFavorite({
      createdAt: createdAt.toISOString(),
      operation: "saved",
      questionId: "question_1",
    })
  ).resolves.toEqual({ ok: true, bookmarked: false });
  expect(
    mocks.database.exerciseQuestionBookmark.deleteMany
  ).toHaveBeenCalledWith({
    where: {
      memberId: "student_1",
      questionId: "question_1",
      createdAt,
    },
  });
});

test("completing an assigned exercise list updates assignment in the answer transaction", async () => {
  mocks.transaction.exerciseAnswer.count.mockResolvedValue(2);
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
      correctOptionIds: ["option_correct"],
      explanation: "Explicação confirmada.",
      isCorrect: true,
      isSessionComplete: true,
      nextHref: null,
      resultHref: "/exercicios/sessoes/session_1/resultado",
      selectedOptionIds: ["option_correct"],
      sessionQuestionId: "session_question_1",
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
  expect(mocks.dispatchPendingNotifications).toHaveBeenCalledTimes(1);
});

test("favorite answers save to their own attempt without completing a list assignment", async () => {
  mocks.database.exerciseSessionQuestion.findFirst.mockResolvedValue({
    ...exerciseQuestion,
    session: {
      ...exerciseQuestion.session,
      kind: "FAVORITE",
      questions: [{ id: "session_question_1", position: 0, answer: null }],
    },
  });
  mocks.transaction.exerciseAnswer.count.mockResolvedValue(1);
  const answerForm = formData({
    sessionId: "session_1",
    sessionQuestionId: "session_question_1",
  });
  answerForm.append("optionIds", "option_correct");

  await expect(
    submitExerciseAnswer({ status: "idle" }, answerForm)
  ).resolves.toMatchObject({
    status: "success",
    feedback: {
      isSessionComplete: true,
      resultHref: "/exercicios/favoritas",
      resultLabel: "Voltar para questões salvas",
    },
  });
  expect(mocks.markLearningAssignmentCompleted).not.toHaveBeenCalled();
  expect(mocks.transaction.exerciseAnswer.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        sessionQuestionId: "session_question_1",
        selectedOptionIds: ["option_correct"],
      }),
    })
  );
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
      nextHref: "/exercicios/sessoes/session_1?questao=session_question_2",
    },
  });
  expect(mocks.redirect).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/exercicios");
  expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
    "/exercicios/historico"
  );
});

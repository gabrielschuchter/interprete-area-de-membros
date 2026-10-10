"use server";

import { randomUUID } from "node:crypto";
import {
  BadgeCriterion,
  ContentStatus,
  database,
  ExerciseQuestionType,
  ExerciseSessionKind,
  ExerciseSessionStatus,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ExerciseAnswerActionState } from "@/components/exercises/exercise-answer-state";
import { requireStaff } from "@/lib/authorization";
import { evaluateMemberBadges } from "@/lib/badges";
import {
  type ExerciseChoiceDraft,
  evaluateExerciseAnswer,
  findMissingExerciseExplanationOptionReferences,
  validateExerciseDraft,
} from "@/lib/exercise-engine";
import { requireMemberId } from "@/lib/learning";
import {
  markLearningAssignmentCompleted,
  markLearningAssignmentStarted,
} from "@/lib/learning-assignments";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const value = (formData: FormData, name: string) => {
  const field = formData.get(name);
  return typeof field === "string" ? field.trim() : "";
};

const optionValues = (formData: FormData): ExerciseChoiceDraft[] =>
  ["A", "B", "C", "D", "E"].flatMap((label, position) => {
    const content = value(formData, `option-${label}`);
    if (!content) {
      return [];
    }
    return [
      {
        id: label,
        content,
        correct: formData.getAll("correctOption").includes(label),
        position,
      },
    ];
  });

const slugBase = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "exercicios";

const uniqueSlug = (text: string) =>
  `${slugBase(text)}-${randomUUID().slice(0, 8)}`;

export const startExerciseSession = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const listId = value(formData, "listId");
  const sessionId = await database.$transaction(async (transaction) => {
    // The transaction-scoped lock serializes starts for this member/list while
    // keeping the invariant inside Postgres and compatible with transaction pooling.
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${memberId}:${listId}`}, 0))::text AS lock_acquired
    `;
    const list = await transaction.exerciseList.findFirst({
      where: {
        id: listId,
        status: ContentStatus.PUBLISHED,
        bank: { is: { status: ContentStatus.PUBLISHED } },
      },
      select: {
        id: true,
        items: {
          where: { question: { is: { status: ContentStatus.PUBLISHED } } },
          orderBy: { position: "asc" },
          select: { questionVersionId: true },
        },
      },
    });
    if (!list || list.items.length === 0) {
      redirect("/exercicios?estado=lista-indisponivel");
    }
    const activeSession = await transaction.exerciseSession.findFirst({
      where: {
        memberId,
        listId,
        kind: ExerciseSessionKind.LIST,
        status: ExerciseSessionStatus.IN_PROGRESS,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (activeSession) {
      return activeSession.id;
    }
    const session = await transaction.exerciseSession.create({
      data: { memberId, listId: list.id, kind: ExerciseSessionKind.LIST },
      select: { id: true },
    });
    await transaction.exerciseSessionQuestion.createMany({
      data: list.items.map(({ questionVersionId }, position) => ({
        sessionId: session.id,
        questionVersionId,
        position,
      })),
    });
    await markLearningAssignmentStarted(
      memberId,
      LearningAssignmentTargetType.EXERCISE_LIST,
      list.id,
      new Date(),
      transaction
    );
    return session.id;
  });
  revalidatePath("/exercicios");
  revalidatePath("/aprender");
  redirect(`/exercicios/sessoes/${sessionId}`);
};

export const startExerciseFavoriteSession = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const questionId = value(formData, "questionId");
  const favorite = await database.exerciseQuestionBookmark.findFirst({
    where: {
      memberId,
      questionId,
      question: {
        is: {
          status: ContentStatus.PUBLISHED,
          bank: { is: { status: ContentStatus.PUBLISHED } },
          listItems: {
            some: {
              list: {
                is: {
                  status: ContentStatus.PUBLISHED,
                  bank: { is: { status: ContentStatus.PUBLISHED } },
                },
              },
            },
          },
        },
      },
    },
    select: {
      question: {
        select: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true },
          },
          listItems: {
            where: {
              list: {
                is: {
                  status: ContentStatus.PUBLISHED,
                  bank: { is: { status: ContentStatus.PUBLISHED } },
                },
              },
            },
            orderBy: { position: "asc" },
            take: 1,
            select: { list: { select: { id: true } } },
          },
        },
      },
    },
  });
  const version = favorite?.question.versions[0];
  const listId = favorite?.question.listItems[0]?.list.id;
  if (!(version && listId)) {
    redirect("/exercicios/favoritas");
  }

  const sessionId = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${memberId}:favorite:${questionId}`}, 0))::text AS lock_acquired
    `;
    const existing = await transaction.exerciseSession.findFirst({
      where: {
        memberId,
        kind: ExerciseSessionKind.FAVORITE,
        status: ExerciseSessionStatus.IN_PROGRESS,
        questions: {
          some: {
            questionVersion: { is: { questionId } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const session = await transaction.exerciseSession.create({
      data: {
        memberId,
        listId,
        kind: ExerciseSessionKind.FAVORITE,
      },
      select: { id: true },
    });
    await transaction.exerciseSessionQuestion.create({
      data: {
        sessionId: session.id,
        questionVersionId: version.id,
        position: 0,
      },
    });
    return session.id;
  });

  redirect(
    `/exercicios/favoritas/${encodeURIComponent(questionId)}?sessao=${encodeURIComponent(sessionId)}`
  );
};

const isPrismaCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

const saveAnswer = async (
  memberId: string,
  sessionId: string,
  sessionQuestionId: string,
  selectedOptionIds: string[]
) => {
  const findTarget = () =>
    database.exerciseSessionQuestion.findFirst({
      where: {
        id: sessionQuestionId,
        sessionId,
        session: {
          memberId,
          status: {
            in: [
              ExerciseSessionStatus.IN_PROGRESS,
              ExerciseSessionStatus.COMPLETED,
            ],
          },
          list: {
            is: {
              status: ContentStatus.PUBLISHED,
              bank: { is: { status: ContentStatus.PUBLISHED } },
            },
          },
        },
      },
      select: {
        id: true,
        position: true,
        answer: {
          select: {
            id: true,
            selectedOptionIds: true,
            isCorrect: true,
          },
        },
        session: {
          select: {
            id: true,
            listId: true,
            kind: true,
            status: true,
            questions: {
              select: {
                id: true,
                position: true,
                answer: { select: { id: true } },
              },
            },
          },
        },
        questionVersion: {
          select: {
            id: true,
            type: true,
            explanation: true,
            question: { select: { id: true } },
            options: {
              select: {
                id: true,
                label: true,
                content: true,
                isCorrect: true,
              },
            },
          },
        },
      },
    });
  const target = await findTarget();
  if (!target) {
    return { ok: false as const, reason: "session" };
  }

  const feedbackFor = (
    answer: {
      readonly isCorrect: boolean;
      readonly selectedOptionIds: readonly string[];
    },
    answeredCount: number
  ) => {
    const sessionPath = `/exercicios/sessoes/${encodeURIComponent(target.session.id)}`;
    const isSessionComplete =
      target.session.status === ExerciseSessionStatus.COMPLETED ||
      answeredCount >= target.session.questions.length;
    const pendingAfterCurrent = target.session.questions
      .filter(({ answer, id }) => !answer && id !== target.id)
      .sort((left, right) => left.position - right.position);
    const nextPendingQuestion =
      pendingAfterCurrent.find(({ position }) => position > target.position) ??
      pendingAfterCurrent[0];
    let nextHref: string | null = null;
    if (
      !isSessionComplete &&
      target.session.kind === ExerciseSessionKind.LIST &&
      nextPendingQuestion
    ) {
      nextHref = `${sessionPath}?questao=${encodeURIComponent(nextPendingQuestion.id)}`;
    }
    return {
      correctOptionIds: target.questionVersion.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id),
      correctOptionLabels: target.questionVersion.options
        .filter((option) => option.isCorrect)
        .map((option) => option.label),
      explanation: target.questionVersion.explanation,
      isCorrect: answer.isCorrect,
      isSessionComplete,
      sessionQuestionId: target.id,
      selectedOptionIds: answer.selectedOptionIds,
      nextHref,
      resultHref:
        target.session.kind === ExerciseSessionKind.FAVORITE
          ? "/exercicios/favoritas"
          : `${sessionPath}/resultado`,
      ...(target.session.kind === ExerciseSessionKind.FAVORITE
        ? { resultLabel: "Voltar para questões salvas" }
        : {}),
    };
  };

  if (target.answer) {
    const answeredCount = await database.exerciseAnswer.count({
      where: {
        sessionQuestion: { is: { sessionId: target.session.id } },
      },
    });
    return {
      ok: true as const,
      alreadyAnswered: true,
      feedback: feedbackFor(target.answer, answeredCount),
    };
  }

  if (target.session.status !== ExerciseSessionStatus.IN_PROGRESS) {
    return { ok: false as const, reason: "session" };
  }

  const evaluated = evaluateExerciseAnswer(
    target.questionVersion.type,
    target.questionVersion.options.map((option) => ({
      ...option,
      correct: option.isCorrect,
    })),
    selectedOptionIds
  );
  if (!evaluated) {
    return { ok: false as const, reason: "answer" };
  }

  const persist = () =>
    tracePerformance("member.exercise.answer.commit", () =>
      database.$transaction(
        async (transaction) => {
          const existing = await transaction.exerciseAnswer.findUnique({
            where: { sessionQuestionId },
            select: { id: true },
          });
          if (existing) {
            return null;
          }
          await transaction.exerciseAnswer.create({
            data: {
              sessionQuestionId,
              selectedOptionIds: [...evaluated.selectedOptionIds],
              isCorrect: evaluated.isCorrect,
            },
          });
          const answered = await transaction.exerciseAnswer.count({
            where: {
              sessionQuestion: { is: { sessionId: target.session.id } },
            },
          });
          const total = target.session.questions.length;
          const completedAt = answered >= total ? new Date() : null;
          await transaction.exerciseSession.update({
            where: { id: target.session.id },
            data: {
              currentPosition: Math.min(target.position + 1, total),
              ...(completedAt
                ? {
                    status: ExerciseSessionStatus.COMPLETED,
                    completedAt,
                  }
                : {}),
            },
          });
          if (completedAt && target.session.kind === ExerciseSessionKind.LIST) {
            await markLearningAssignmentCompleted(
              memberId,
              LearningAssignmentTargetType.EXERCISE_LIST,
              target.session.listId,
              completedAt,
              transaction
            );
          }
          await tracePerformance("member.exercise.badge-update", () =>
            evaluateMemberBadges(
              transaction,
              memberId,
              completedAt ?? new Date(),
              {
                criteria: [BadgeCriterion.EXERCISE_ANSWERS],
                force: true,
              }
            )
          );
          return {
            answeredCount: answered,
            isSessionComplete: Boolean(completedAt),
          };
        },
        { isolationLevel: "Serializable" }
      )
    );

  let persisted: Awaited<ReturnType<typeof persist>> | null = null;
  try {
    persisted = await persist();
  } catch (error) {
    if (isPrismaCode(error, "P2034")) {
      persisted = await persist();
    } else if (isPrismaCode(error, "P2002")) {
      persisted = null;
    } else {
      throw error;
    }
  }

  if (!persisted) {
    const latestTarget = await findTarget();
    if (!latestTarget?.answer) {
      throw new Error("The exercise answer was not available after save.");
    }
    const latestCount = await database.exerciseAnswer.count({
      where: {
        sessionQuestion: { is: { sessionId: latestTarget.session.id } },
      },
    });
    return {
      ok: true as const,
      alreadyAnswered: true,
      feedback: feedbackFor(latestTarget.answer, latestCount),
    };
  }

  return {
    ok: true as const,
    alreadyAnswered: false,
    feedback: feedbackFor(
      {
        isCorrect: evaluated.isCorrect,
        selectedOptionIds: evaluated.selectedOptionIds,
      },
      persisted.answeredCount
    ),
  };
};

export const submitExerciseAnswer = async (
  _previousState: ExerciseAnswerActionState,
  formData: FormData
): Promise<ExerciseAnswerActionState> => {
  const memberId = await requireMemberId();
  const sessionId = value(formData, "sessionId");
  const sessionQuestionId = value(formData, "sessionQuestionId");
  if (!(sessionId && sessionQuestionId)) {
    return { status: "error", message: "Esta questão não está disponível." };
  }
  const selectedOptionIds = formData
    .getAll("optionIds")
    .flatMap((option) => (typeof option === "string" ? [option] : []));
  let result: Awaited<ReturnType<typeof saveAnswer>>;
  try {
    result = await saveAnswer(
      memberId,
      sessionId,
      sessionQuestionId,
      selectedOptionIds
    );
  } catch {
    return {
      status: "error",
      sessionQuestionId,
      retryable: true,
      message:
        "Não foi possível confirmar sua resposta. Sua seleção foi mantida. Verifique a conexão e tente novamente.",
    };
  }
  if (!result.ok) {
    return {
      status: "error",
      sessionQuestionId,
      message:
        result.reason === "answer"
          ? "Selecione uma alternativa válida antes de confirmar."
          : "Esta sessão não está mais disponível. Atualize a página para continuar.",
    };
  }
  if (!result.alreadyAnswered) {
    await tracePerformance("member.notification.dispatch", () =>
      dispatchPendingNotifications()
    );
  }
  // Keep the answer in the active form state so feedback is shown on this
  // question. These views query the database on navigation; invalidating sibling
  // routes from this Server Action also refreshes the active RSC tree and can
  // redirect the just-answered question into review before feedback is shown.
  return { status: "success", feedback: result.feedback };
};

const revalidateExerciseFavoriteSurfaces = (sessionId?: string) => {
  revalidatePath("/exercicios");
  revalidatePath("/exercicios/favoritas");
  revalidatePath("/comunidade/salvos");
  if (sessionId) {
    revalidatePath(`/exercicios/sessoes/${sessionId}`);
  }
};

export const getExerciseFavoriteStatus = async (questionId: string) => {
  const memberId = await requireMemberId();
  const bookmark = await database.exerciseQuestionBookmark.findUnique({
    where: {
      memberId_questionId: { memberId, questionId },
    },
    select: { id: true },
  });
  return { bookmarked: Boolean(bookmark) };
};

const memberCanAccessExerciseFavorite = async (
  memberId: string,
  questionId: string,
  sessionId?: string
) => {
  if (sessionId) {
    return Boolean(
      await database.exerciseSessionQuestion.findFirst({
        where: {
          sessionId,
          questionVersion: { is: { questionId } },
          session: {
            memberId,
            status: {
              in: [
                ExerciseSessionStatus.IN_PROGRESS,
                ExerciseSessionStatus.COMPLETED,
              ],
            },
          },
        },
        select: { id: true },
      })
    );
  }

  return Boolean(
    await database.exerciseQuestion.findFirst({
      where: {
        id: questionId,
        status: ContentStatus.PUBLISHED,
        bank: { is: { status: ContentStatus.PUBLISHED } },
        listItems: {
          some: {
            list: {
              is: {
                status: ContentStatus.PUBLISHED,
                bank: { is: { status: ContentStatus.PUBLISHED } },
              },
            },
          },
        },
      },
      select: { id: true },
    })
  );
};

const exerciseBookmarkSelectKey = (memberId: string, questionId: string) => ({
  memberId_questionId: { memberId, questionId },
});

const createExerciseFavorite = async (
  memberId: string,
  questionId: string,
  sessionId?: string
) => {
  const key = exerciseBookmarkSelectKey(memberId, questionId);
  let existing = await database.exerciseQuestionBookmark.findUnique({
    where: key,
    select: { createdAt: true },
  });
  let createdByThisAction = false;
  if (!existing) {
    try {
      existing = await database.exerciseQuestionBookmark.create({
        data: { memberId, questionId },
        select: { createdAt: true },
      });
      createdByThisAction = true;
    } catch (error) {
      if (!isPrismaCode(error, "P2002")) {
        throw error;
      }
      existing = await database.exerciseQuestionBookmark.findUnique({
        where: key,
        select: { createdAt: true },
      });
      if (!existing) {
        throw error;
      }
    }
  }
  if (!existing) {
    throw new Error("Favorite bookmark was not available after save.");
  }
  revalidateExerciseFavoriteSurfaces(sessionId);
  return {
    ok: true as const,
    bookmarked: true as const,
    operation: createdByThisAction ? ("saved" as const) : null,
    createdAt: existing.createdAt.toISOString(),
  };
};

const removeExerciseFavorite = async (
  memberId: string,
  questionId: string,
  sessionId?: string
) => {
  const key = { memberId_questionId: { memberId, questionId } };
  const existing = await database.exerciseQuestionBookmark.findUnique({
    where: key,
    select: { createdAt: true },
  });
  if (!existing) {
    return { ok: true as const, bookmarked: false as const, operation: null };
  }
  await database.exerciseQuestionBookmark.deleteMany({
    where: {
      memberId,
      questionId,
      createdAt: existing.createdAt,
    },
  });
  const remaining = await database.exerciseQuestionBookmark.findUnique({
    where: key,
    select: { createdAt: true },
  });
  revalidateExerciseFavoriteSurfaces(sessionId);
  return {
    ok: true as const,
    bookmarked: Boolean(remaining),
    operation: remaining ? null : ("removed" as const),
    createdAt:
      remaining?.createdAt.toISOString() ?? existing.createdAt.toISOString(),
  };
};

export const updateExerciseFavorite = async (input: {
  readonly desired: boolean;
  readonly questionId: string;
  readonly sessionId?: string;
}) => {
  const memberId = await requireMemberId();
  if (!(input.questionId && input.questionId.length <= 128)) {
    return { ok: false as const, bookmarked: false as const };
  }
  const canAccess = await memberCanAccessExerciseFavorite(
    memberId,
    input.questionId,
    input.sessionId
  );
  if (!canAccess) {
    return { ok: false as const, bookmarked: false as const };
  }
  return input.desired
    ? createExerciseFavorite(memberId, input.questionId, input.sessionId)
    : removeExerciseFavorite(memberId, input.questionId, input.sessionId);
};

export const undoExerciseFavorite = async (input: {
  readonly createdAt: string;
  readonly operation: "removed" | "saved";
  readonly questionId: string;
}) => {
  const memberId = await requireMemberId();
  const createdAt = new Date(input.createdAt);
  if (
    !input.questionId ||
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== input.createdAt
  ) {
    return { ok: false as const, bookmarked: false };
  }

  if (input.operation === "saved") {
    const result = await database.exerciseQuestionBookmark.deleteMany({
      where: { memberId, questionId: input.questionId, createdAt },
    });
    if (result.count !== 1) {
      const current = await database.exerciseQuestionBookmark.findUnique({
        where: {
          memberId_questionId: { memberId, questionId: input.questionId },
        },
        select: { id: true },
      });
      return { ok: false as const, bookmarked: Boolean(current) };
    }
  } else {
    try {
      await database.exerciseQuestionBookmark.create({
        data: { memberId, questionId: input.questionId, createdAt },
      });
    } catch (error) {
      if (isPrismaCode(error, "P2002")) {
        const current = await database.exerciseQuestionBookmark.findUnique({
          where: {
            memberId_questionId: { memberId, questionId: input.questionId },
          },
          select: { id: true },
        });
        return { ok: false as const, bookmarked: Boolean(current) };
      }
      throw error;
    }
  }

  revalidateExerciseFavoriteSurfaces();
  return {
    ok: true as const,
    bookmarked: input.operation === "removed",
  };
};

const validatedQuestionDraft = (formData: FormData) => {
  const kind = value(formData, "questionType") as ExerciseQuestionType;
  const statement = value(formData, "statement");
  const explanation = value(formData, "explanation").slice(0, 20_000);
  const options = optionValues(formData);
  if (
    !Object.values(ExerciseQuestionType).includes(kind) ||
    statement.length > 20_000 ||
    options.some(({ content }) => content.length > 8000)
  ) {
    return null;
  }
  return { kind, statement, explanation, options };
};

const editableExerciseListSelect = {
  id: true,
  bankId: true,
  status: true,
  bank: { select: { status: true } },
  items: { select: { id: true, questionId: true, position: true } },
} satisfies Prisma.ExerciseListSelect;

type EditableExerciseList = Prisma.ExerciseListGetPayload<{
  select: typeof editableExerciseListSelect;
}>;

type ValidatedExerciseQuestion = NonNullable<
  ReturnType<typeof validatedQuestionDraft>
>;

const findEditableExerciseList = (
  transaction: Prisma.TransactionClient,
  listId: string
) =>
  transaction.exerciseList.findFirst({
    where: { id: listId },
    select: editableExerciseListSelect,
  });

const upsertExerciseCategory = (
  transaction: Prisma.TransactionClient,
  bankId: string,
  title: string
) => {
  if (!title) {
    return null;
  }
  const slug = slugBase(title);
  return transaction.exerciseCategory.upsert({
    where: { bankId_slug: { bankId, slug } },
    create: { bankId, title, slug },
    update: { title },
    select: { id: true },
  });
};

const createQuestionVersion = (
  transaction: Prisma.TransactionClient,
  questionId: string,
  version: number,
  draft: ValidatedExerciseQuestion
) =>
  transaction.exerciseQuestionVersion.create({
    data: {
      questionId,
      version,
      type: draft.kind,
      statement: draft.statement,
      explanation: draft.explanation || null,
      options: {
        create: draft.options.map((option, position) => ({
          label: option.id,
          content: option.content,
          isCorrect: option.correct,
          position,
        })),
      },
    },
    select: { id: true },
  });

const saveExistingQuestionVersion = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly categoryId: string | null;
    readonly draft: ValidatedExerciseQuestion;
    readonly existing: {
      readonly id: string;
      readonly latestVersion: number;
      readonly listItems: readonly { readonly id: string }[];
    };
    readonly formData: FormData;
    readonly status: ContentStatus;
  }
) => {
  const version = input.existing.latestVersion + 1;
  const createdVersion = await createQuestionVersion(
    transaction,
    input.existing.id,
    version,
    input.draft
  );
  await transaction.exerciseQuestion.update({
    where: { id: input.existing.id },
    data: {
      type: input.draft.kind,
      status: input.status,
      latestVersion: version,
      categoryId: input.categoryId ?? null,
      tags: parseTags(input.formData),
    },
  });
  const listItem = input.existing.listItems[0];
  if (!listItem) {
    throw new Error("Questão sem vínculo válido com a lista.");
  }
  await transaction.exerciseListItem.update({
    where: { id: listItem.id },
    data: { questionVersionId: createdVersion.id },
  });
};

const addQuestionToExerciseList = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly categoryId: string | null;
    readonly draft: ValidatedExerciseQuestion;
    readonly formData: FormData;
    readonly list: EditableExerciseList;
    readonly status: ContentStatus;
  }
) => {
  const question = await transaction.exerciseQuestion.create({
    data: {
      bankId: input.list.bankId,
      categoryId: input.categoryId,
      slug: uniqueSlug("questao"),
      type: input.draft.kind,
      status: input.status,
      tags: parseTags(input.formData),
    },
    select: { id: true },
  });
  const version = await createQuestionVersion(
    transaction,
    question.id,
    1,
    input.draft
  );
  const position =
    input.list.items.reduce(
      (highest, item) => Math.max(highest, item.position),
      -1
    ) + 1;
  await transaction.exerciseListItem.create({
    data: {
      listId: input.list.id,
      questionId: question.id,
      questionVersionId: version.id,
      position,
    },
  });
};

export const createExercisePack = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const bankTitle = value(formData, "bankTitle").slice(0, 160);
  const listTitle = value(formData, "listTitle").slice(0, 160);
  const listDescription = value(formData, "listDescription").slice(0, 2000);
  const coverUrl = value(formData, "coverUrl");
  const categoryTitle = value(formData, "categoryTitle").slice(0, 100);
  const draft = validatedQuestionDraft(formData);
  const publish = value(formData, "publish") === "true";
  if (
    !(bankTitle && listTitle && draft) ||
    (coverUrl && !isHttpsUrl(coverUrl))
  ) {
    redirect("/admin/exercicios?resultado=invalid");
  }
  const validDraft = draft;
  if (
    findMissingExerciseExplanationOptionReferences(
      validDraft.explanation,
      validDraft.options
    ).length > 0
  ) {
    redirect("/admin/exercicios?resultado=referencias-invalidas");
  }
  const validation = validateExerciseDraft(
    validDraft.kind,
    validDraft.statement,
    validDraft.options
  );
  if (!validation.valid) {
    redirect("/admin/exercicios?resultado=invalid");
  }
  const status = publish ? ContentStatus.PUBLISHED : ContentStatus.DRAFT;
  const bankSlug = uniqueSlug(bankTitle);
  const listSlug = uniqueSlug(listTitle);
  const questionSlug = uniqueSlug("questao");
  await database.$transaction(async (transaction) => {
    const bank = await transaction.exerciseBank.create({
      data: {
        title: bankTitle,
        slug: bankSlug,
        status,
        createdByMemberId: userId,
      },
      select: { id: true },
    });
    const category = categoryTitle
      ? await transaction.exerciseCategory.create({
          data: {
            bankId: bank.id,
            title: categoryTitle,
            slug: uniqueSlug(categoryTitle),
          },
          select: { id: true },
        })
      : null;
    const question = await transaction.exerciseQuestion.create({
      data: {
        bankId: bank.id,
        categoryId: category?.id ?? null,
        slug: questionSlug,
        type: validDraft.kind,
        status,
        tags: parseTags(formData),
      },
      select: { id: true },
    });
    const version = await transaction.exerciseQuestionVersion.create({
      data: {
        questionId: question.id,
        version: 1,
        type: validDraft.kind,
        statement: validDraft.statement,
        explanation: validDraft.explanation || null,
        options: {
          create: validDraft.options.map((option, position) => ({
            label: option.id,
            content: option.content,
            isCorrect: option.correct,
            position,
          })),
        },
      },
      select: { id: true },
    });
    const list = await transaction.exerciseList.create({
      data: {
        bankId: bank.id,
        title: listTitle,
        slug: listSlug,
        description: listDescription || null,
        coverUrl: coverUrl || null,
        status,
        publishedAt: publish ? new Date() : null,
        createdByMemberId: userId,
      },
      select: { id: true },
    });
    await transaction.exerciseListItem.create({
      data: {
        listId: list.id,
        questionId: question.id,
        questionVersionId: version.id,
        position: 0,
      },
    });
  });
  revalidatePath("/admin/exercicios");
  revalidatePath("/exercicios");
  redirect("/admin/exercicios?resultado=created");
};

export const saveExerciseQuestion = async (formData: FormData) => {
  await requireStaff();
  const listId = value(formData, "listId");
  const questionId = value(formData, "questionId");
  const categoryTitle = value(formData, "categoryTitle").slice(0, 100);
  const draft = validatedQuestionDraft(formData);
  const validation = draft
    ? validateExerciseDraft(draft.kind, draft.statement, draft.options)
    : null;
  if (!listId) {
    redirect("/admin/exercicios?resultado=invalid");
  }
  if (!(draft && validation?.valid)) {
    redirect(
      `/admin/exercicios/${encodeURIComponent(listId)}?resultado=invalid`
    );
  }
  if (
    findMissingExerciseExplanationOptionReferences(
      draft.explanation,
      draft.options
    ).length > 0
  ) {
    redirect(
      `/admin/exercicios/${encodeURIComponent(listId)}?resultado=referencias-invalidas`
    );
  }
  const validDraft = draft;
  await database.$transaction(
    async (transaction) => {
      const list = await findEditableExerciseList(transaction, listId);
      if (!list || list.bank.status === ContentStatus.ARCHIVED) {
        throw new Error("Lista de exercícios indisponível para edição.");
      }
      const nextStatus =
        list.status === ContentStatus.PUBLISHED &&
        list.bank.status === ContentStatus.PUBLISHED
          ? ContentStatus.PUBLISHED
          : ContentStatus.DRAFT;
      const category = await upsertExerciseCategory(
        transaction,
        list.bankId,
        categoryTitle
      );
      if (questionId) {
        const existing = await transaction.exerciseQuestion.findFirst({
          where: {
            id: questionId,
            bankId: list.bankId,
            listItems: { some: { listId } },
          },
          select: {
            id: true,
            latestVersion: true,
            listItems: { where: { listId }, select: { id: true } },
          },
        });
        if (!existing) {
          throw new Error("Questão não pertence à lista.");
        }
        await saveExistingQuestionVersion(transaction, {
          categoryId: category?.id ?? null,
          draft: validDraft,
          existing,
          formData,
          status: nextStatus,
        });
        return;
      }
      await addQuestionToExerciseList(transaction, {
        categoryId: category?.id ?? null,
        draft: validDraft,
        formData,
        list,
        status: nextStatus,
      });
    },
    { isolationLevel: "Serializable" }
  );
  revalidatePath("/admin/exercicios");
  revalidatePath("/exercicios");
  redirect(
    `/admin/exercicios/${encodeURIComponent(listId)}?resultado=questao-salva`
  );
};

export const setExerciseListStatus = async (formData: FormData) => {
  await requireStaff();
  const listId = value(formData, "listId");
  const requestedStatus = value(formData, "status") as ContentStatus;
  if (
    ![
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      ContentStatus.ARCHIVED,
    ].includes(requestedStatus)
  ) {
    redirect("/admin/exercicios?resultado=invalid");
  }
  await database.$transaction(async (transaction) => {
    const list = await transaction.exerciseList.findUnique({
      where: { id: listId },
      select: {
        id: true,
        bankId: true,
        items: { select: { questionId: true } },
      },
    });
    if (!list) {
      throw new Error("Lista de exercícios não encontrada.");
    }
    if (
      requestedStatus === ContentStatus.PUBLISHED &&
      list.items.length === 0
    ) {
      throw new Error("Adicione ao menos uma questão antes de publicar.");
    }
    if (requestedStatus === ContentStatus.PUBLISHED) {
      await transaction.exerciseBank.update({
        where: { id: list.bankId },
        data: { status: ContentStatus.PUBLISHED },
      });
      await transaction.exerciseQuestion.updateMany({
        where: { id: { in: list.items.map(({ questionId }) => questionId) } },
        data: { status: ContentStatus.PUBLISHED },
      });
    }
    await transaction.exerciseList.update({
      where: { id: list.id },
      data: {
        status: requestedStatus,
        publishedAt:
          requestedStatus === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });
  });
  revalidatePath("/admin/exercicios");
  revalidatePath(`/admin/exercicios/${listId}`);
  revalidatePath("/exercicios");
  redirect(`/admin/exercicios/${encodeURIComponent(listId)}`);
};

const parseTags = (formData: FormData) =>
  [
    ...new Set(
      value(formData, "tags")
        .split(",")
        .map((tag) => tag.trim().toLocaleLowerCase("pt-BR"))
        .filter(Boolean)
    ),
  ].slice(0, 20);

const isHttpsUrl = (candidate: string) => {
  try {
    return new URL(candidate).protocol === "https:";
  } catch {
    return false;
  }
};

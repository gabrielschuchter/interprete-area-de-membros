"use server";

import { randomUUID } from "node:crypto";
import {
  BadgeCriterion,
  ContentStatus,
  database,
  ExerciseQuestionType,
  ExerciseSessionStatus,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/authorization";
import { evaluateMemberBadges } from "@/lib/badges";
import {
  type ExerciseChoiceDraft,
  evaluateExerciseAnswer,
  validateExerciseDraft,
} from "@/lib/exercise-engine";
import { requireMemberId } from "@/lib/learning";
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
  const list = await database.exerciseList.findFirst({
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

  const sessionId = await database.$transaction(async (transaction) => {
    const session = await transaction.exerciseSession.create({
      data: { memberId, listId: list.id },
      select: { id: true },
    });
    await transaction.exerciseSessionQuestion.createMany({
      data: list.items.map(({ questionVersionId }, position) => ({
        sessionId: session.id,
        questionVersionId,
        position,
      })),
    });
    return session.id;
  });
  revalidatePath("/exercicios");
  redirect(`/exercicios/sessoes/${sessionId}`);
};

const isPrismaCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

const saveAnswer = async (
  memberId: string,
  sessionQuestionId: string,
  selectedOptionIds: string[]
) => {
  const target = await database.exerciseSessionQuestion.findFirst({
    where: {
      id: sessionQuestionId,
      session: {
        memberId,
        status: ExerciseSessionStatus.IN_PROGRESS,
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
      answer: { select: { id: true } },
      session: {
        select: {
          id: true,
          questions: { select: { id: true } },
        },
      },
      questionVersion: {
        select: {
          id: true,
          question: { select: { type: true } },
          options: { select: { id: true, content: true, isCorrect: true } },
        },
      },
    },
  });
  if (!target) {
    return { ok: false as const, reason: "session" };
  }
  if (target.answer) {
    return { ok: true as const, alreadyAnswered: true };
  }

  const evaluated = evaluateExerciseAnswer(
    target.questionVersion.question.type,
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
    database.$transaction(
      async (transaction) => {
        const existing = await transaction.exerciseAnswer.findUnique({
          where: { sessionQuestionId },
          select: { id: true },
        });
        if (existing) {
          return;
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
        await transaction.exerciseSession.update({
          where: { id: target.session.id },
          data: {
            currentPosition: Math.min(target.position + 1, total),
            ...(answered >= total
              ? {
                  status: ExerciseSessionStatus.COMPLETED,
                  completedAt: new Date(),
                }
              : {}),
          },
        });
        await evaluateMemberBadges(transaction, memberId, new Date(), {
          criteria: [BadgeCriterion.EXERCISE_ANSWERS],
          force: true,
        });
      },
      { isolationLevel: "Serializable" }
    );

  try {
    await persist();
  } catch (error) {
    if (isPrismaCode(error, "P2034")) {
      await persist();
    } else if (!isPrismaCode(error, "P2002")) {
      throw error;
    }
  }
  return { ok: true as const, alreadyAnswered: false };
};

export const submitExerciseAnswer = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const sessionId = value(formData, "sessionId");
  const sessionQuestionId = value(formData, "sessionQuestionId");
  const selectedOptionIds = formData
    .getAll("optionIds")
    .flatMap((option) => (typeof option === "string" ? [option] : []));
  const result = await saveAnswer(
    memberId,
    sessionQuestionId,
    selectedOptionIds
  );
  if (!result.ok) {
    redirect(
      `/exercicios/sessoes/${encodeURIComponent(sessionId)}?erro=${result.reason}`
    );
  }
  if (!result.alreadyAnswered) {
    await dispatchPendingNotifications();
  }
  revalidatePath("/exercicios");
  redirect(
    `/exercicios/sessoes/${encodeURIComponent(sessionId)}?respondida=${encodeURIComponent(sessionQuestionId)}`
  );
};

export const toggleExerciseFavorite = async (formData: FormData) => {
  const memberId = await requireMemberId();
  const questionId = value(formData, "questionId");
  const sessionId = value(formData, "sessionId");
  const requestedAction = value(formData, "action");
  const accessible = sessionId
    ? await database.exerciseSessionQuestion.findFirst({
        where: {
          sessionId,
          questionVersion: { is: { questionId } },
          session: {
            memberId,
            list: {
              is: {
                status: ContentStatus.PUBLISHED,
                bank: { is: { status: ContentStatus.PUBLISHED } },
              },
            },
          },
        },
        select: { sessionId: true },
      })
    : await database.exerciseQuestion.findFirst({
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
      });
  if (!accessible) {
    redirect("/exercicios");
  }
  if (requestedAction === "remove") {
    await database.exerciseQuestionBookmark.deleteMany({
      where: { memberId, questionId },
    });
  } else {
    await database.exerciseQuestionBookmark.upsert({
      where: { memberId_questionId: { memberId, questionId } },
      create: { memberId, questionId },
      update: {},
    });
  }
  revalidatePath("/exercicios/favoritas");
  if (sessionId) {
    revalidatePath(`/exercicios/sessoes/${sessionId}`);
  }
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
  if (!(listId && draft && validation?.valid)) {
    redirect("/admin/exercicios?resultado=invalid");
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

"use server";

import { ActivitySubmissionStatus, database, Prisma } from "@repo/database";
import { enqueueNotificationBatch } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { parseActivityReview } from "@/lib/gestao-activity-review-domain";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import type { CorrectionActionState } from "@/lib/gestao-correction-contract";
import { getGestaoCorrectionRecipientScope } from "@/lib/gestao-correction-scope";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

const activityCorrectionReturnPattern =
  /^\/gestao\/ensino\/atividades\/[A-Za-z0-9_-]+\/entregas(?:\?|$)/;

const stringValue = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const readVersion = (formData: FormData, name: string) => {
  const value = Number(stringValue(formData, name));
  return Number.isInteger(value) && value >= 0 ? value : null;
};

const correctionReturnPath = (formData: FormData) => {
  const candidate = stringValue(formData, "returnTo");
  if (
    candidate.startsWith("/gestao/alunos/correcoes") ||
    activityCorrectionReturnPattern.test(candidate)
  ) {
    return candidate;
  }
  return "/gestao/alunos/correcoes";
};

const resultPath = (path: string, result: string, submissionId?: string) => {
  const url = new URL(path, "http://gestao.local");
  url.searchParams.set("resultado", result);
  if (result === "feedback-enviado") {
    url.searchParams.set("estado", "REVIEWED");
  }
  if (submissionId) {
    url.searchParams.set("entrega", submissionId);
  }
  return `${url.pathname}${url.search}`;
};

type ReviewTransaction = Prisma.TransactionClient;

interface CorrectionSubmissionRecord {
  readonly activity: { readonly slug: string; readonly title: string };
  readonly activityId: string;
  readonly id: string;
  readonly memberId: string;
  readonly rubricVersion: number;
  readonly status: ActivitySubmissionStatus;
  readonly submittedAt: Date;
  readonly updatedAt: Date;
}

interface CorrectionContext {
  readonly draft: { readonly version: number } | null;
  readonly sentFeedback: { readonly version: number } | null;
  readonly submission: CorrectionSubmissionRecord;
}

const throwCorrectionConflict = (): never => {
  throw new Error("GESTAO_CORRECTION_CONFLICT");
};

const readCorrectionContext = async (input: {
  readonly transaction: ReviewTransaction;
  readonly submissionId: string;
  readonly recipientWhere: ReturnType<typeof getGestaoCorrectionRecipientScope>;
  readonly preview: {
    readonly rubricVersion: number;
    readonly submittedAt: Date;
    readonly updatedAt: Date;
  };
  readonly draftVersion: number;
}): Promise<CorrectionContext> => {
  const submission = await input.transaction.activitySubmission.findFirst({
    where: {
      id: input.submissionId,
      status: {
        in: [
          ActivitySubmissionStatus.SUBMITTED,
          ActivitySubmissionStatus.REVIEWED,
        ],
      },
      member: { is: input.recipientWhere },
    },
    select: {
      id: true,
      activityId: true,
      memberId: true,
      rubricVersion: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      activity: { select: { slug: true, title: true } },
    },
  });
  const submittedAt = submission?.submittedAt;
  if (!submission) {
    forbidden();
  }
  if (
    !submittedAt ||
    submission.rubricVersion !== input.preview.rubricVersion ||
    submittedAt.valueOf() !== input.preview.submittedAt.valueOf() ||
    submission.updatedAt.valueOf() !== input.preview.updatedAt.valueOf()
  ) {
    return throwCorrectionConflict();
  }
  const reviewableSubmission: CorrectionSubmissionRecord = {
    ...submission,
    submittedAt,
  };

  const [draft, sentFeedback] = await Promise.all([
    input.transaction.activityFeedbackDraft.findUnique({
      where: { submissionId: input.submissionId },
      select: { version: true },
    }),
    input.transaction.feedback.findUnique({
      where: { submissionId: input.submissionId },
      select: { version: true },
    }),
  ]);
  if ((draft?.version ?? 0) !== input.draftVersion) {
    return throwCorrectionConflict();
  }
  return { submission: reviewableSubmission, draft, sentFeedback };
};

const saveCorrectionDraft = async (input: {
  readonly transaction: ReviewTransaction;
  readonly submission: CorrectionSubmissionRecord;
  readonly draft: CorrectionContext["draft"];
  readonly submissionId: string;
  readonly actorId: string;
  readonly draftVersion: number;
  readonly content: string;
  readonly criteriaScores: Prisma.InputJsonObject;
}) => {
  if (input.draft) {
    const updated = await input.transaction.activityFeedbackDraft.updateMany({
      where: { submissionId: input.submissionId, version: input.draftVersion },
      data: {
        reviewerId: input.actorId,
        content: input.content,
        rubricVersion: input.submission.rubricVersion,
        criteriaScores: input.criteriaScores,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return throwCorrectionConflict();
    }
  } else {
    await input.transaction.activityFeedbackDraft.create({
      data: {
        submissionId: input.submissionId,
        reviewerId: input.actorId,
        content: input.content,
        rubricVersion: input.submission.rubricVersion,
        criteriaScores: input.criteriaScores,
      },
    });
  }
  return "saved" as const;
};

const sendCorrectionFeedback = async (input: {
  readonly transaction: ReviewTransaction;
  readonly context: CorrectionContext;
  readonly submissionId: string;
  readonly actorId: string;
  readonly draftVersion: number;
  readonly feedbackVersion: number;
  readonly content: string;
  readonly criteriaScores: Prisma.InputJsonObject;
  readonly now: Date;
}) => {
  const { draft, sentFeedback, submission } = input.context;
  if ((sentFeedback?.version ?? 0) !== input.feedbackVersion) {
    return throwCorrectionConflict();
  }
  const nextFeedbackVersion = input.feedbackVersion + 1;
  if (sentFeedback) {
    const updated = await input.transaction.feedback.updateMany({
      where: {
        submissionId: input.submissionId,
        version: input.feedbackVersion,
      },
      data: {
        teacherId: input.actorId,
        content: input.content,
        rubricVersion: submission.rubricVersion,
        criteriaScores: input.criteriaScores,
        submittedAt: input.now,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return throwCorrectionConflict();
    }
  } else {
    await input.transaction.feedback.create({
      data: {
        submissionId: input.submissionId,
        teacherId: input.actorId,
        content: input.content,
        rubricVersion: submission.rubricVersion,
        criteriaScores: input.criteriaScores,
        submittedAt: input.now,
      },
    });
  }

  const markedReviewed = await input.transaction.activitySubmission.updateMany({
    where: {
      id: input.submissionId,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      status: {
        in: [
          ActivitySubmissionStatus.SUBMITTED,
          ActivitySubmissionStatus.REVIEWED,
        ],
      },
    },
    data: { status: ActivitySubmissionStatus.REVIEWED },
  });
  if (markedReviewed.count !== 1) {
    return throwCorrectionConflict();
  }
  if (draft) {
    const deleted = await input.transaction.activityFeedbackDraft.deleteMany({
      where: { submissionId: input.submissionId, version: input.draftVersion },
    });
    if (deleted.count !== 1) {
      return throwCorrectionConflict();
    }
  }

  await enqueueNotificationBatch(input.transaction, {
    actorId: input.actorId,
    aggregateType: "activity_feedback",
    aggregateId: input.submissionId,
    idempotencyKey: [
      "activity-feedback:",
      input.submissionId,
      ":v",
      nextFeedbackVersion,
    ].join(""),
    occurredAt: input.now,
    notifications: [
      {
        recipientId: submission.memberId,
        type: "FEEDBACK_RECEIVED",
        entityType: "SUBMISSION",
        entityId: input.submissionId,
        dedupeKey: [
          "feedback:",
          input.submissionId,
          ":v",
          nextFeedbackVersion,
        ].join(""),
        href: ["/atividades", submission.activity.slug].join("/"),
      },
    ],
  });
  return "sent" as const;
};

const correctionActionError = (
  code: NonNullable<CorrectionActionState["code"]>,
  fieldErrors?: CorrectionActionState["fieldErrors"]
): CorrectionActionState => ({ status: "error", code, fieldErrors });

type CorrectionActor = Awaited<ReturnType<typeof requireGestaoAction>>["actor"];
type ParsedCorrectionReview = Extract<
  ReturnType<typeof parseActivityReview>,
  { readonly ok: true }
>;

interface PreparedCorrection {
  readonly draftVersion: number;
  readonly feedbackVersion: number;
  readonly intent: "draft" | "send";
  readonly parsed: ParsedCorrectionReview;
  readonly preview: {
    readonly activityId: string;
    readonly rubricVersion: number;
    readonly submittedAt: Date;
    readonly updatedAt: Date;
    readonly activity: { readonly slug: string };
  };
  readonly returnTo: string;
  readonly submissionId: string;
}

type PrepareCorrectionResult =
  | { readonly ok: true; readonly value: PreparedCorrection }
  | { readonly ok: false; readonly state: CorrectionActionState };

const correctionFieldErrors = (
  reason: Extract<
    ReturnType<typeof parseActivityReview>,
    { readonly ok: false }
  >["reason"]
): CorrectionActionState["fieldErrors"] => {
  if (reason === "comment-required" || reason === "comment-too-long") {
    return { content: "Revise o comentário antes de enviar." };
  }
  if (reason === "scores-required" || reason === "score-invalid") {
    return { scores: "Revise as notas da rubrica antes de enviar." };
  }
  return undefined;
};

const prepareCorrection = async (
  formData: FormData,
  actor: CorrectionActor
): Promise<PrepareCorrectionResult> => {
  const submissionId = stringValue(formData, "submissionId");
  const intent = stringValue(formData, "intent");
  const returnTo = correctionReturnPath(formData);
  const loadedSubmittedAt = stringValue(formData, "submittedAt");
  const loadedUpdatedAt = stringValue(formData, "submissionUpdatedAt");
  const draftVersion = readVersion(formData, "draftVersion");
  const feedbackVersion = readVersion(formData, "feedbackVersion");
  if (
    !submissionId ||
    (intent !== "draft" && intent !== "send") ||
    !loadedSubmittedAt ||
    !loadedUpdatedAt ||
    draftVersion === null ||
    feedbackVersion === null
  ) {
    return { ok: false, state: correctionActionError("dados-invalidos") };
  }

  const recipientWhere = getGestaoCorrectionRecipientScope(actor);
  const preview = await database.activitySubmission.findFirst({
    where: {
      id: submissionId,
      status: {
        in: [
          ActivitySubmissionStatus.SUBMITTED,
          ActivitySubmissionStatus.REVIEWED,
        ],
      },
      member: { is: recipientWhere },
    },
    select: {
      id: true,
      activityId: true,
      memberId: true,
      rubricVersion: true,
      submittedAt: true,
      updatedAt: true,
      activity: { select: { slug: true, title: true } },
    },
  });
  if (!preview) {
    forbidden();
  }
  const previewSubmittedAt = preview.submittedAt;
  if (
    !previewSubmittedAt ||
    previewSubmittedAt.toISOString() !== loadedSubmittedAt ||
    preview.updatedAt.toISOString() !== loadedUpdatedAt
  ) {
    return { ok: false, state: correctionActionError("conflito") };
  }

  const criteria = await database.activityRubricCriterion.findMany({
    where: { activityId: preview.activityId, version: preview.rubricVersion },
    orderBy: { position: "asc" },
    take: 12,
    select: { id: true, weight: true },
  });
  const parsed = parseActivityReview(formData, criteria, intent);
  if (!parsed.ok) {
    return {
      ok: false,
      state: correctionActionError(
        parsed.reason,
        correctionFieldErrors(parsed.reason)
      ),
    };
  }

  return {
    ok: true,
    value: {
      draftVersion,
      feedbackVersion,
      intent,
      parsed,
      returnTo,
      submissionId,
      preview: {
        activityId: preview.activityId,
        rubricVersion: preview.rubricVersion,
        submittedAt: previewSubmittedAt,
        updatedAt: preview.updatedAt,
        activity: { slug: preview.activity.slug },
      },
    },
  };
};

const isCorrectionConflict = (error: unknown) => {
  if (
    error instanceof Error &&
    error.message === "GESTAO_CORRECTION_CONFLICT"
  ) {
    return true;
  }
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === "P2002" || error.code === "P2034";
};

export const saveGestaoCorrection = async (
  _previousState: CorrectionActionState,
  formData: FormData
): Promise<CorrectionActionState> => {
  const { actor } = await requireGestaoAction("assignments.manage");
  await consumeMutationRateLimit({
    action: "activity.mutation",
    memberId: actor.userId,
  });
  const prepared = await prepareCorrection(formData, actor);
  if (!prepared.ok) {
    return prepared.state;
  }
  const input = prepared.value;
  const now = new Date();

  let outcome: "saved" | "sent";
  try {
    outcome = await database.$transaction(
      async (transaction) => {
        const currentMember = await transaction.member.findUnique({
          where: { id: actor.userId },
          select: { role: true, deactivatedAt: true },
        });
        if (
          !currentMember ||
          currentMember.deactivatedAt ||
          (currentMember.role !== "ADMIN" && currentMember.role !== "TEACHER")
        ) {
          forbidden();
        }
        const context = await readCorrectionContext({
          transaction,
          submissionId: input.submissionId,
          recipientWhere: getGestaoCorrectionRecipientScope({
            userId: actor.userId,
            role: currentMember.role,
          }),
          preview: input.preview,
          draftVersion: input.draftVersion,
        });
        const criteriaScores: Prisma.InputJsonObject = {
          ...input.parsed.scores,
        };
        if (input.intent === "draft") {
          return saveCorrectionDraft({
            transaction,
            submission: context.submission,
            draft: context.draft,
            submissionId: input.submissionId,
            actorId: actor.userId,
            draftVersion: input.draftVersion,
            content: input.parsed.content,
            criteriaScores,
          });
        }
        return sendCorrectionFeedback({
          transaction,
          context,
          submissionId: input.submissionId,
          actorId: actor.userId,
          draftVersion: input.draftVersion,
          feedbackVersion: input.feedbackVersion,
          content: input.parsed.content,
          criteriaScores,
          now,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (!isCorrectionConflict(error)) {
      throw error;
    }
    return correctionActionError("conflito");
  }

  if (outcome === "sent") {
    await dispatchPendingNotifications();
    revalidatePath(["/atividades", input.preview.activity.slug].join("/"));
    revalidatePath("/atividades");
    revalidatePath("/aprender");
    revalidatePath("/estudar");
  }
  revalidatePath("/gestao/alunos/correcoes");
  revalidatePath("/gestao");
  revalidatePath(
    ["/gestao/ensino/atividades", input.preview.activityId, "entregas"].join(
      "/"
    )
  );
  const code = outcome === "sent" ? "feedback-enviado" : "rascunho-salvo";
  return {
    status: "success",
    code,
    href: resultPath(input.returnTo, code, input.submissionId),
  };
};

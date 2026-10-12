"use server";

import { createHash, randomUUID } from "node:crypto";
import {
  ContentStatus,
  CourseExperience,
  database,
  type Prisma,
} from "@repo/database";
import { enqueueDomainEvent } from "@repo/member-domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  type GestaoLearningPathFormState,
  isGestaoLearningPathStatusTransitionAllowed,
  parseGestaoLearningPathWrite,
} from "@/lib/gestao-learning-path-domain";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const inputHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const eventKey = (actorId: string, key: string) =>
  `gestao-learning-path:${createHash("sha256").update(actorId).digest("hex").slice(0, 16)}:${key}`;

const errorState = (
  message: string,
  fieldErrors?: GestaoLearningPathFormState["fieldErrors"]
): GestaoLearningPathFormState => ({
  fieldErrors,
  idempotencyKey: randomUUID(),
  message,
  status: "error",
});

class LearningPathConflict extends Error {}
class LearningPathNotFound extends Error {}
class LearningPathNeedsPublishedConfirmation extends Error {}
class LearningPathTransitionInvalid extends Error {}

const matchingReplay = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly eventKey: string;
    readonly eventType: string;
    readonly requestHash: string;
    readonly aggregateId?: string;
  }
) => {
  const event = await transaction.domainEvent.findUnique({
    where: { idempotencyKey: input.eventKey },
    select: {
      actorId: true,
      aggregateId: true,
      aggregateType: true,
      eventType: true,
      payload: true,
    },
  });
  if (!event) {
    return null;
  }
  const payload =
    typeof event.payload === "object" &&
    event.payload !== null &&
    !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};
  if (
    event.actorId !== input.actorId ||
    event.aggregateType !== "LearningPath" ||
    event.eventType !== input.eventType ||
    (input.aggregateId !== undefined &&
      event.aggregateId !== input.aggregateId) ||
    payload.requestHash !== input.requestHash
  ) {
    throw new LearningPathConflict();
  }
  return event.aggregateId;
};

const recordPathEvent = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId: string;
    readonly aggregateId: string;
    readonly eventKey: string;
    readonly eventType: string;
    readonly requestHash: string;
    readonly details?: Prisma.InputJsonObject;
  }
) =>
  enqueueDomainEvent(transaction, {
    eventType: input.eventType,
    actorId: input.actorId,
    aggregateType: "LearningPath",
    aggregateId: input.aggregateId,
    idempotencyKey: input.eventKey,
    payload: {
      requestHash: input.requestHash,
      ...(input.details ?? {}),
    },
    occurredAt: new Date(),
    consumers: [],
  });

const handleMutationError = (error: unknown) => {
  if (error instanceof LearningPathNotFound) {
    return errorState("Este percurso não existe mais. Volte ao catálogo.");
  }
  if (error instanceof LearningPathNeedsPublishedConfirmation) {
    return errorState(
      "Este percurso foi publicado. Confirme que as alterações ficarão visíveis imediatamente."
    );
  }
  if (error instanceof LearningPathTransitionInvalid) {
    return errorState(
      "O estado do percurso mudou. Atualize a página antes de confirmar."
    );
  }
  if (error instanceof LearningPathConflict) {
    return errorState(
      "Outra edição foi salva primeiro. Atualize a página para carregar a versão atual."
    );
  }
  if (isUniqueConstraintError(error)) {
    return errorState("Este endereço já está sendo usado por outro percurso.", {
      slug: "Escolha um endereço diferente.",
    });
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return errorState(
      "Outra alteração aconteceu ao mesmo tempo. Atualize a página e tente novamente."
    );
  }
  return errorState("Não foi possível salvar agora. Tente novamente.");
};

const statusFailureCode = (error: unknown) => {
  if (error instanceof LearningPathNotFound) {
    return "nao-encontrado";
  }
  if (
    error instanceof LearningPathConflict ||
    error instanceof LearningPathTransitionInvalid ||
    isUniqueConstraintError(error) ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034")
  ) {
    return "conflito";
  }
  return "erro";
};

const revalidateLearningPaths = (pathId?: string) => {
  revalidatePath("/gestao/ensino/cursos");
  revalidatePath("/gestao/ensino/cursos/percursos/novo");
  if (pathId) {
    revalidatePath(`/gestao/ensino/cursos/percursos/${pathId}`);
  }
  revalidatePath("/admin/learning");
  revalidatePath("/aprender");
};

const learningPathHref = (pathId: string, page: number, state?: string) => {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("pagina", String(page));
  }
  if (state) {
    params.set("estado", state);
  }
  const query = params.toString();
  return `/gestao/ensino/cursos/percursos/${pathId}${query ? `?${query}` : ""}`;
};

export const createGestaoLearningPath = async (
  _previousState: GestaoLearningPathFormState,
  formData: FormData
): Promise<GestaoLearningPathFormState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const parsed = parseGestaoLearningPathWrite(formData);
  if (!parsed.ok) {
    return errorState(parsed.message, parsed.fieldErrors);
  }
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  if (!key) {
    return errorState("Atualize o formulário e tente novamente.");
  }

  const fingerprint = inputHash(parsed.input);
  const operationKey = eventKey(actor.userId, key);
  let pathId: string;
  try {
    pathId = await database.$transaction(
      async (transaction) => {
        const replay = await matchingReplay(transaction, {
          actorId: actor.userId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.created",
          requestHash: fingerprint,
        });
        if (replay) {
          return replay;
        }
        const lastPath = await transaction.learningPath.findFirst({
          orderBy: { position: "desc" },
          select: { position: true },
        });
        const path = await transaction.learningPath.create({
          data: {
            ...parsed.input,
            position: (lastPath?.position ?? -1) + 1,
          },
          select: { id: true },
        });
        await recordPathEvent(transaction, {
          actorId: actor.userId,
          aggregateId: path.id,
          eventKey: operationKey,
          eventType: "gestao.learning-path.created",
          requestHash: fingerprint,
          details: { status: ContentStatus.DRAFT },
        });
        return path.id;
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    return handleMutationError(error);
  }

  revalidateLearningPaths(pathId);
  redirect(`/gestao/ensino/cursos/percursos/${pathId}`);
};

export const updateGestaoLearningPath = async (
  _previousState: GestaoLearningPathFormState,
  formData: FormData
): Promise<GestaoLearningPathFormState> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const parsed = parseGestaoLearningPathWrite(formData);
  if (!parsed.ok) {
    return errorState(parsed.message, parsed.fieldErrors);
  }
  const pathId = text(formData, "pathId");
  const requestedPage = Number(text(formData, "page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const expectedVersion = new Date(text(formData, "expectedUpdatedAt"));
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  if (
    !pathId ||
    pathId.length > 128 ||
    !Number.isFinite(expectedVersion.getTime()) ||
    !key
  ) {
    return errorState("Atualize o formulário e tente novamente.");
  }
  const confirmPublishedChange =
    formData.get("confirmPublishedChange") === "on";
  const fingerprint = inputHash({
    ...parsed.input,
    confirmPublishedChange,
    pathId,
    expectedVersion: expectedVersion.toISOString(),
  });
  const operationKey = eventKey(actor.userId, key);
  try {
    await database.$transaction(
      async (transaction) => {
        const replay = await matchingReplay(transaction, {
          actorId: actor.userId,
          aggregateId: pathId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.updated",
          requestHash: fingerprint,
        });
        if (replay) {
          return;
        }
        const current = await transaction.learningPath.findUnique({
          where: { id: pathId },
          select: {
            title: true,
            slug: true,
            description: true,
            status: true,
            updatedAt: true,
          },
        });
        if (!current) {
          throw new LearningPathNotFound();
        }
        if (current.updatedAt.getTime() !== expectedVersion.getTime()) {
          throw new LearningPathConflict();
        }
        const contentChanged =
          current.title !== parsed.input.title ||
          current.slug !== parsed.input.slug ||
          current.description !== parsed.input.description;
        if (
          current.status === ContentStatus.PUBLISHED &&
          contentChanged &&
          !confirmPublishedChange
        ) {
          throw new LearningPathNeedsPublishedConfirmation();
        }
        const updated = await transaction.learningPath.updateMany({
          where: { id: pathId, updatedAt: expectedVersion },
          data: parsed.input,
        });
        if (updated.count !== 1) {
          throw new LearningPathConflict();
        }
        await recordPathEvent(transaction, {
          actorId: actor.userId,
          aggregateId: pathId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.updated",
          requestHash: fingerprint,
          details: { status: current.status },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    return handleMutationError(error);
  }

  revalidateLearningPaths(pathId);
  redirect(learningPathHref(pathId, page));
};

export const changeGestaoLearningPathStatus = async (
  formData: FormData
): Promise<never> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const pathId = text(formData, "pathId");
  const requestedPage = Number(text(formData, "page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const nextStatusValue = text(formData, "nextStatus");
  const expectedVersion = new Date(text(formData, "expectedUpdatedAt"));
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  if (
    !pathId ||
    pathId.length > 128 ||
    !Number.isFinite(expectedVersion.getTime()) ||
    !key ||
    !Object.values(ContentStatus).includes(nextStatusValue as ContentStatus) ||
    formData.get("confirmStatusChange") !== "on"
  ) {
    redirect(
      pathId
        ? learningPathHref(pathId, page, "nao-confirmado")
        : "/gestao/ensino/cursos?aba=percursos"
    );
  }
  const nextStatus = nextStatusValue as ContentStatus;
  const fingerprint = inputHash({
    nextStatus,
    pathId,
    expectedVersion: expectedVersion.toISOString(),
  });
  const operationKey = eventKey(actor.userId, key);
  try {
    await database.$transaction(
      async (transaction) => {
        const replay = await matchingReplay(transaction, {
          actorId: actor.userId,
          aggregateId: pathId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.status-changed",
          requestHash: fingerprint,
        });
        if (replay) {
          return;
        }
        const current = await transaction.learningPath.findUnique({
          where: { id: pathId },
          select: { status: true, updatedAt: true },
        });
        if (
          !current ||
          current.updatedAt.getTime() !== expectedVersion.getTime()
        ) {
          throw current
            ? new LearningPathConflict()
            : new LearningPathNotFound();
        }
        if (
          !isGestaoLearningPathStatusTransitionAllowed(
            current.status,
            nextStatus
          )
        ) {
          throw new LearningPathTransitionInvalid();
        }
        const updated = await transaction.learningPath.updateMany({
          where: { id: pathId, updatedAt: expectedVersion },
          data: {
            status: nextStatus,
            publishedAt:
              nextStatus === ContentStatus.PUBLISHED ? new Date() : null,
          },
        });
        if (updated.count !== 1) {
          throw new LearningPathConflict();
        }
        await recordPathEvent(transaction, {
          actorId: actor.userId,
          aggregateId: pathId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.status-changed",
          requestHash: fingerprint,
          details: { from: current.status, to: nextStatus },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    redirect(learningPathHref(pathId, page, statusFailureCode(error)));
  }

  revalidateLearningPaths(pathId);
  redirect(learningPathHref(pathId, page));
};

export const moveGestaoLearningPathCourse = async (
  formData: FormData
): Promise<never> => {
  const { actor } = await requireGestaoAction("content.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const pathId = text(formData, "pathId");
  const requestedPage = Number(text(formData, "page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const courseId = text(formData, "courseId");
  const neighborId = text(formData, "neighborId");
  const direction = text(formData, "direction");
  const expectedPathVersion = new Date(text(formData, "expectedPathUpdatedAt"));
  const expectedCourseVersion = new Date(
    text(formData, "expectedCourseUpdatedAt")
  );
  const expectedNeighborVersion = new Date(
    text(formData, "expectedNeighborUpdatedAt")
  );
  const key = readIdempotencyKey(formData.get("idempotencyKey"));
  const confirmPublishedChange =
    formData.get("confirmPublishedChange") === "on";
  const invalid =
    !pathId ||
    pathId.length > 128 ||
    !courseId ||
    courseId.length > 128 ||
    !neighborId ||
    neighborId.length > 128 ||
    courseId === neighborId ||
    (direction !== "up" && direction !== "down") ||
    !Number.isFinite(expectedPathVersion.getTime()) ||
    !Number.isFinite(expectedCourseVersion.getTime()) ||
    !Number.isFinite(expectedNeighborVersion.getTime()) ||
    !key;
  if (invalid) {
    redirect(
      pathId
        ? learningPathHref(pathId, page, "ordem-conflito")
        : "/gestao/ensino/cursos?aba=percursos"
    );
  }

  const fingerprint = inputHash({
    confirmPublishedChange,
    courseId,
    direction,
    expectedCourseVersion: expectedCourseVersion.toISOString(),
    expectedNeighborVersion: expectedNeighborVersion.toISOString(),
    expectedPathVersion: expectedPathVersion.toISOString(),
    neighborId,
    pathId,
  });
  const operationKey = eventKey(actor.userId, key);
  let failureCode: string | null = null;
  try {
    await database.$transaction(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Version, adjacency, and confirmation checks must share the serializable course swap transaction.
      async (transaction) => {
        const replay = await matchingReplay(transaction, {
          actorId: actor.userId,
          aggregateId: pathId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.course-reordered",
          requestHash: fingerprint,
        });
        if (replay) {
          return;
        }
        const path = await transaction.learningPath.findUnique({
          where: { id: pathId },
          select: { status: true, updatedAt: true },
        });
        if (!path) {
          throw new LearningPathNotFound();
        }
        if (path.updatedAt.getTime() !== expectedPathVersion.getTime()) {
          throw new LearningPathConflict();
        }
        if (
          path.status === ContentStatus.PUBLISHED &&
          !confirmPublishedChange
        ) {
          throw new LearningPathNeedsPublishedConfirmation();
        }
        const courses = await transaction.course.findMany({
          where: {
            learningPathId: pathId,
            experience: CourseExperience.ASYNC,
            id: { in: [courseId, neighborId] },
          },
          select: { id: true, position: true, updatedAt: true },
        });
        const current = courses.find((course) => course.id === courseId);
        const neighbor = courses.find((course) => course.id === neighborId);
        if (
          !(current && neighbor) ||
          current.updatedAt.getTime() !== expectedCourseVersion.getTime() ||
          neighbor.updatedAt.getTime() !== expectedNeighborVersion.getTime()
        ) {
          throw new LearningPathConflict();
        }

        const adjacentCourse = await transaction.course.findFirst({
          where: {
            learningPathId: pathId,
            experience: CourseExperience.ASYNC,
            position:
              direction === "up"
                ? { lt: current.position }
                : { gt: current.position },
          },
          orderBy: { position: direction === "up" ? "desc" : "asc" },
          select: { id: true },
        });
        if (adjacentCourse?.id !== neighbor.id) {
          throw new LearningPathConflict();
        }

        const positions = await transaction.course.aggregate({
          where: { learningPathId: pathId },
          _min: { position: true },
        });
        const temporaryPosition = (positions._min.position ?? 0) - 1;
        const moved = await transaction.course.updateMany({
          where: { id: current.id, updatedAt: expectedCourseVersion },
          data: { position: temporaryPosition },
        });
        if (moved.count !== 1) {
          throw new LearningPathConflict();
        }
        const neighborMoved = await transaction.course.updateMany({
          where: { id: neighbor.id, updatedAt: expectedNeighborVersion },
          data: { position: current.position },
        });
        if (neighborMoved.count !== 1) {
          throw new LearningPathConflict();
        }
        const currentMoved = await transaction.course.updateMany({
          where: { id: current.id, position: temporaryPosition },
          data: { position: neighbor.position },
        });
        if (currentMoved.count !== 1) {
          throw new LearningPathConflict();
        }
        await recordPathEvent(transaction, {
          actorId: actor.userId,
          aggregateId: pathId,
          eventKey: operationKey,
          eventType: "gestao.learning-path.course-reordered",
          requestHash: fingerprint,
          details: {
            courseId,
            direction,
            neighborId,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof LearningPathNotFound) {
      failureCode = "nao-encontrado";
    } else if (error instanceof LearningPathNeedsPublishedConfirmation) {
      failureCode = "ordem-nao-confirmada";
    } else if (
      error instanceof LearningPathConflict ||
      isUniqueConstraintError(error) ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034")
    ) {
      failureCode = "ordem-conflito";
    } else {
      failureCode = "ordem-erro";
    }
  }
  if (failureCode) {
    redirect(learningPathHref(pathId, page, failureCode));
  }

  revalidateLearningPaths(pathId);
  redirect(learningPathHref(pathId, page));
};

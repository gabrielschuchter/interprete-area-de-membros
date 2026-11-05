import "server-only";

import {
  AccessResourceType,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";

/**
 * Exclusão real (não arquivamento) do conteúdo da Gestão, pedida em 05/11/2026.
 *
 * Cada função roda dentro da transação de quem chama e apaga, antes do
 * registro principal, tudo o que o banco não apaga sozinho: vínculos com
 * `onDelete: Restrict`, itens de coleção que ficariam vazios (`SetNull`) e as
 * referências polimórficas sem chave estrangeira (acessos diretos e
 * atribuições). O tempo de estudo e as anotações dos membros ficam: são
 * histórico deles, não do conteúdo.
 */

type Tx = Prisma.TransactionClient;

export type GestaoErasableKind =
  | "activity"
  | "assignment"
  | "badge"
  | "bank"
  | "cohort"
  | "collection"
  | "course"
  | "exercise-list"
  | "goal"
  | "group"
  | "learning-path"
  | "lesson"
  | "library-item"
  | "meeting"
  | "module"
  | "post"
  | "task";

export class GestaoErasureBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GestaoErasureBlockedError";
  }
}

interface AssignmentTarget {
  readonly ids: readonly string[];
  readonly type: LearningAssignmentTargetType;
}

const eraseAssignments = async (
  tx: Tx,
  targets: readonly AssignmentTarget[]
) => {
  const where = targets
    .filter(({ ids }) => ids.length > 0)
    .map(({ ids, type }) => ({ targetType: type, targetId: { in: [...ids] } }));
  if (where.length === 0) {
    return;
  }
  const batches = await tx.learningAssignmentBatch.findMany({
    where: { OR: where },
    select: { id: true },
  });
  const batchIds = batches.map(({ id }) => id);
  await tx.activityAssignment.deleteMany({
    where: {
      OR: [
        ...where,
        ...(batchIds.length ? [{ batchId: { in: batchIds } }] : []),
      ],
    },
  });
  if (batchIds.length) {
    await tx.learningAssignmentBatch.deleteMany({
      where: { id: { in: batchIds } },
    });
  }
};

const eraseDirectAccess = async (
  tx: Tx,
  resourceType: AccessResourceType,
  ids: readonly string[]
) => {
  if (ids.length === 0) {
    return;
  }
  const where = { resourceType, resourceId: { in: [...ids] } };
  await tx.accessGrant.deleteMany({ where });
  await tx.accessGrantSource.deleteMany({ where });
};

const eraseLessonsById = async (tx: Tx, lessonIds: readonly string[]) => {
  if (lessonIds.length === 0) {
    return;
  }
  const ids = [...lessonIds];
  const assets = await tx.lessonAsset.findMany({
    where: { lessonId: { in: ids } },
    select: { id: true },
  });
  const assetIds = assets.map(({ id }) => id);
  const historical = await tx.importedRecording.count({
    where: {
      OR: [
        { legacyLessonId: { in: ids } },
        ...(assetIds.length ? [{ assetId: { in: assetIds } }] : []),
      ],
    },
  });
  if (historical > 0) {
    throw new GestaoErasureBlockedError(
      "Há gravações históricas importadas presas a este conteúdo. Desvincule-as em Administração › Gravações históricas antes de apagar."
    );
  }
  await tx.contentCollectionItem.deleteMany({
    where: {
      OR: [
        { lessonId: { in: ids } },
        ...(assetIds.length ? [{ assetId: { in: assetIds } }] : []),
      ],
    },
  });
  await tx.cohortLessonRelease.deleteMany({ where: { lessonId: { in: ids } } });
  await eraseDirectAccess(tx, AccessResourceType.LESSON, ids);
  await eraseDirectAccess(tx, AccessResourceType.ASSET, assetIds);
  await eraseAssignments(tx, [
    { type: LearningAssignmentTargetType.LESSON, ids },
    { type: LearningAssignmentTargetType.ASSET, ids: assetIds },
  ]);
  // Recursos, vídeos, uploads, progresso e marcadores caem em cascata.
  await tx.lesson.deleteMany({ where: { id: { in: ids } } });
};

const eraseModulesById = async (tx: Tx, moduleIds: readonly string[]) => {
  if (moduleIds.length === 0) {
    return;
  }
  const ids = [...moduleIds];
  const historicalGroups = await tx.importedRecordingGroup.count({
    where: { legacyModuleId: { in: ids } },
  });
  if (historicalGroups > 0) {
    throw new GestaoErasureBlockedError(
      "Este conteúdo guarda gravações históricas importadas. Elas não podem ser apagadas por aqui."
    );
  }
  const lessons = await tx.lesson.findMany({
    where: { moduleId: { in: ids } },
    select: { id: true },
  });
  await eraseLessonsById(
    tx,
    lessons.map(({ id }) => id)
  );
  await eraseDirectAccess(tx, AccessResourceType.MODULE, ids);
  await eraseAssignments(tx, [
    { type: LearningAssignmentTargetType.MODULE, ids },
  ]);
  await tx.module.deleteMany({ where: { id: { in: ids } } });
};

const eraseCourse = async (tx: Tx, courseId: string) => {
  const modules = await tx.module.findMany({
    where: { courseId },
    select: { id: true },
  });
  await eraseModulesById(
    tx,
    modules.map(({ id }) => id)
  );
  await tx.cohortCourseAccess.deleteMany({ where: { courseId } });
  await tx.contentCollectionItem.deleteMany({ where: { courseId } });
  await eraseDirectAccess(tx, AccessResourceType.COURSE, [courseId]);
  await eraseAssignments(tx, [
    { type: LearningAssignmentTargetType.COURSE, ids: [courseId] },
  ]);
  // Matrículas e marcadores caem em cascata; atividades e encontros ficam
  // sem o vínculo com o curso (SetNull).
  await tx.course.delete({ where: { id: courseId } });
};

const eraseExerciseListsById = async (tx: Tx, listIds: readonly string[]) => {
  if (listIds.length === 0) {
    return;
  }
  const ids = [...listIds];
  // As sessões de resolução dessa lista saem junto (respostas em cascata).
  await tx.exerciseSession.deleteMany({ where: { listId: { in: ids } } });
  await tx.contentCollectionItem.deleteMany({
    where: { exerciseListId: { in: ids } },
  });
  await eraseAssignments(tx, [
    { type: LearningAssignmentTargetType.EXERCISE_LIST, ids },
  ]);
  await tx.exerciseList.deleteMany({ where: { id: { in: ids } } });
};

const eraseExerciseBank = async (tx: Tx, bankId: string) => {
  const lists = await tx.exerciseList.findMany({
    where: { bankId },
    select: { id: true },
  });
  await eraseExerciseListsById(
    tx,
    lists.map(({ id }) => id)
  );
  // Questões deste banco usadas em listas ou sessões de outros bancos.
  const questions = await tx.exerciseQuestion.findMany({
    where: { bankId },
    select: { id: true },
  });
  const questionIds = questions.map(({ id }) => id);
  if (questionIds.length) {
    await tx.exerciseListItem.deleteMany({
      where: { questionId: { in: questionIds } },
    });
    await tx.exerciseSessionQuestion.deleteMany({
      where: { questionVersion: { is: { questionId: { in: questionIds } } } },
    });
  }
  // Categorias, questões, versões, alternativas e favoritos em cascata.
  await tx.exerciseBank.delete({ where: { id: bankId } });
};

const eraseActivity = async (tx: Tx, activityId: string) => {
  await eraseAssignments(tx, [
    { type: LearningAssignmentTargetType.ACTIVITY, ids: [activityId] },
  ]);
  // Turmas-alvo, critérios, entregas e correções em cascata.
  await tx.activity.delete({ where: { id: activityId } });
};

const eraseLibraryItem = async (tx: Tx, itemId: string) => {
  await tx.contentCollectionItem.deleteMany({
    where: { libraryItemId: itemId },
  });
  await eraseAssignments(tx, [
    { type: LearningAssignmentTargetType.LIBRARY_ITEM, ids: [itemId] },
  ]);
  const item = await tx.libraryItem.delete({
    where: { id: itemId },
    select: { storagePath: true },
  });
  return item.storagePath;
};

const eraseCohort = async (tx: Tx, cohortId: string) => {
  // O acesso por turma é calculado na leitura: sem a matrícula e sem a
  // liberação, os alunos deixam de ver o que vinha só desta turma.
  await tx.cohortMembership.deleteMany({ where: { cohortId } });
  await tx.cohortCourseAccess.deleteMany({ where: { cohortId } });
  await tx.cohortLessonRelease.deleteMany({ where: { cohortId } });
  await tx.cohortEvent.deleteMany({ where: { cohortId } });
  await tx.activityCohortTarget.deleteMany({ where: { cohortId } });
  await tx.announcementCohort.deleteMany({ where: { cohortId } });
  await tx.meetingCohortTarget.deleteMany({ where: { cohortId } });
  // Professores, convites, feeds de calendário e fontes de acesso em cascata.
  await tx.cohort.delete({ where: { id: cohortId } });
};

const erasePost = async (tx: Tx, postId: string) => {
  const comments = await tx.communityComment.findMany({
    where: { postId },
    select: { id: true },
  });
  await tx.mention.deleteMany({
    where: { entityId: { in: [postId, ...comments.map(({ id }) => id)] } },
  });
  // Comentários, votos, salvos, seguidores e links de compartilhamento em
  // cascata.
  await tx.communityPost.delete({ where: { id: postId } });
};

const eraseGroup = async (tx: Tx, spaceId: string) => {
  const posts = await tx.communityPost.findMany({
    where: { spaceId },
    select: { id: true },
  });
  for (const { id } of posts) {
    await erasePost(tx, id);
  }
  // Coleções que usavam o grupo como público passam a valer para todos.
  await tx.contentCollection.updateMany({
    where: { audienceSpaceId: spaceId },
    data: { audienceSpaceId: null },
  });
  await tx.communitySpace.delete({ where: { id: spaceId } });
};

const eraseAssignmentBatch = async (tx: Tx, batchId: string) => {
  await tx.activityAssignment.deleteMany({ where: { batchId } });
  await tx.learningAssignmentBatch.delete({ where: { id: batchId } });
};

const eraseGoal = async (tx: Tx, campaignId: string) => {
  await tx.studyCampaignSnapshot.deleteMany({ where: { campaignId } });
  await tx.studyCampaign.delete({ where: { id: campaignId } });
};

const eraseBadge = async (tx: Tx, badgeId: string) => {
  // Quem já ganhou perde a medalha: ela deixa de existir na plataforma.
  await tx.badgeAward.deleteMany({ where: { badgeId } });
  await tx.badgeDefinitionRevision.deleteMany({ where: { badgeId } });
  await tx.badgeDefinition.delete({ where: { id: badgeId } });
};

/**
 * Apaga o registro e devolve, quando houver, o caminho de arquivo no
 * Storage que o chamador deve remover depois do commit.
 */
export const eraseGestaoContent = async (
  tx: Tx,
  kind: GestaoErasableKind,
  id: string
): Promise<string | null> => {
  switch (kind) {
    case "activity":
      await eraseActivity(tx, id);
      return null;
    case "assignment":
      await eraseAssignmentBatch(tx, id);
      return null;
    case "badge":
      await eraseBadge(tx, id);
      return null;
    case "bank":
      await eraseExerciseBank(tx, id);
      return null;
    case "cohort":
      await eraseCohort(tx, id);
      return null;
    case "collection":
      await tx.contentCollection.delete({ where: { id } });
      return null;
    case "course":
      await eraseCourse(tx, id);
      return null;
    case "exercise-list":
      await eraseExerciseListsById(tx, [id]);
      return null;
    case "goal":
      await eraseGoal(tx, id);
      return null;
    case "group":
      await eraseGroup(tx, id);
      return null;
    case "learning-path":
      // Os cursos do percurso continuam, soltos (SetNull).
      await tx.learningPath.delete({ where: { id } });
      return null;
    case "lesson":
      await eraseLessonsById(tx, [id]);
      return null;
    case "library-item":
      return eraseLibraryItem(tx, id);
    case "meeting":
      // Participantes, presenças e alvos em cascata; gravações ficam soltas.
      await tx.meeting.delete({ where: { id } });
      return null;
    case "module":
      await eraseModulesById(tx, [id]);
      return null;
    case "post":
      await erasePost(tx, id);
      return null;
    case "task":
      // Destinatários e conclusões em cascata.
      await tx.learningTask.delete({ where: { id } });
      return null;
    default:
      return null;
  }
};

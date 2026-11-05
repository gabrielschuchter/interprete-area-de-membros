import "server-only";
import { database, MemberRole, type Prisma } from "@repo/database";

import type {
  ErasureBlocker,
  ErasureCounts,
} from "./gestao-member-erasure-labels";

type Client = Prisma.TransactionClient | typeof database;

export type {
  ErasureBlocker,
  ErasureCounts,
} from "./gestao-member-erasure-labels";

export interface ErasurePreview {
  readonly blockers: readonly ErasureBlocker[];
  readonly counts: ErasureCounts;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
}

/** Texto que o administrador digita para liberar o botão de apagar. */
export const erasureConfirmation = (preview: {
  readonly email: string | null;
  readonly id: string;
}) => (preview.email?.trim() || preview.id).toLowerCase();

/**
 * Registros da equipe que guardam quem fez a ação com chave obrigatória
 * (onDelete Restrict). Ao apagar alguém da equipe eles passam para quem está
 * apagando, para que turmas, convites e eventos continuem de pé.
 */
const staffRecordModels = [
  ["cohort", "createdByMemberId"],
  ["cohortTeacher", "assignedByMemberId"],
  ["cohortInvite", "createdByMemberId"],
  ["cohortCourseAccess", "createdByMemberId"],
  ["cohortLessonRelease", "updatedByMemberId"],
  ["cohortEvent", "createdByMemberId"],
  ["cohortEventOccurrenceException", "updatedByMemberId"],
  ["meetingOccurrenceException", "updatedByMemberId"],
  ["importedRecordingGroupAssignment", "changedByMemberId"],
] as const;

interface StaffRecordDelegate {
  count: (args: { where: Record<string, string> }) => Promise<number>;
  updateMany: (args: {
    data: Record<string, string>;
    where: Record<string, string>;
  }) => Promise<unknown>;
}

const staffDelegate = (client: Client, model: string) =>
  (client as unknown as Record<string, StaffRecordDelegate>)[model];

const staffRecordCount = (client: Client, memberId: string) =>
  Promise.all(
    staffRecordModels.map(([model, field]) =>
      staffDelegate(client, model).count({ where: { [field]: memberId } })
    )
  ).then((counts) => counts.reduce((sum, value) => sum + value, 0));

/** Grupos do membro com outras pessoas dentro: apagar o dono os deixaria sem dono. */
const sharedSpaceCount = (client: Client, memberId: string) =>
  client.communitySpace.count({
    where: {
      ownerId: memberId,
      members: { some: { memberId: { not: memberId } } },
    },
  });

export const getErasurePreview = async (
  memberId: string,
  actorId: string,
  client: Client = database
): Promise<ErasurePreview | null> => {
  const member = await client.member.findUnique({
    where: { id: memberId },
    select: { displayName: true, email: true, id: true, role: true },
  });
  if (!member) {
    return null;
  }
  const [
    posts,
    comments,
    commentsFromOthers,
    postVotes,
    commentVotes,
    bookmarks,
    enrollments,
    lessonProgress,
    cohortMemberships,
    submissions,
    notes,
    staffRecords,
    sharedSpaces,
    otherAdmins,
  ] = await Promise.all([
    client.communityPost.count({ where: { authorId: memberId } }),
    client.communityComment.count({ where: { authorId: memberId } }),
    client.communityComment.count({
      where: { authorId: { not: memberId }, post: { authorId: memberId } },
    }),
    client.postVote.count({ where: { memberId } }),
    client.commentVote.count({ where: { memberId } }),
    client.communityBookmark.count({ where: { memberId } }),
    client.enrollment.count({ where: { memberId } }),
    client.lessonProgress.count({ where: { memberId } }),
    client.cohortMembership.count({ where: { memberId } }),
    client.activitySubmission.count({ where: { memberId } }),
    client.plannerNote.count({ where: { memberId } }),
    staffRecordCount(client, memberId),
    sharedSpaceCount(client, memberId),
    member.role === MemberRole.ADMIN
      ? client.member.count({
          where: {
            deactivatedAt: null,
            id: { not: memberId },
            role: MemberRole.ADMIN,
          },
        })
      : Promise.resolve(1),
  ]);
  const blockers: ErasureBlocker[] = [];
  if (member.id === actorId) {
    blockers.push("self");
  }
  if (member.role === MemberRole.ADMIN && otherAdmins === 0) {
    blockers.push("last-admin");
  }
  return {
    blockers,
    counts: {
      bookmarks,
      cohortMemberships,
      comments,
      commentsFromOthers,
      enrollments,
      lessonProgress,
      notes,
      posts,
      sharedSpaces,
      staffRecords,
      submissions,
      votes: postVotes + commentVotes,
    },
    displayName: member.displayName,
    email: member.email,
    id: member.id,
  };
};

/**
 * Grupos com outras pessoas continuam vivos: a posse passa para quem entrou
 * primeiro depois do dono, que vira OWNER na lista de membros.
 */
const transferSharedSpaces = async (
  transaction: Prisma.TransactionClient,
  memberId: string
) => {
  const spaces = await transaction.communitySpace.findMany({
    where: {
      ownerId: memberId,
      members: { some: { memberId: { not: memberId } } },
    },
    select: {
      id: true,
      normalizedTitle: true,
      members: {
        where: { memberId: { not: memberId } },
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        take: 1,
        select: { memberId: true },
      },
    },
  });
  for (const space of spaces) {
    const heir = space.members[0]?.memberId;
    // Dois grupos do mesmo dono não podem ter o mesmo título; nesse caso o
    // grupo fica sem dono, como já acontecia, e a equipe ainda o modera.
    const clash = heir
      ? await transaction.communitySpace.count({
          where: { ownerId: heir, normalizedTitle: space.normalizedTitle },
        })
      : 1;
    if (!heir || clash > 0) {
      continue;
    }
    await transaction.communitySpace.update({
      where: { id: space.id },
      data: { ownerId: heir },
    });
    await transaction.communitySpaceMember.update({
      where: { spaceId_memberId: { spaceId: space.id, memberId: heir } },
      data: { role: "OWNER" },
    });
  }
};

/**
 * Apaga o membro e tudo o que ele produziu. As relações com onDelete Cascade
 * saem junto com a linha de Member; as tabelas que guardam o id sem chave
 * estrangeira (comunidade, matrículas, progresso, envios de upload) são
 * limpas aqui, na mesma transação. Registros de auditoria (DomainEvent) ficam.
 */
export const eraseMemberRecords = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  actorId: string
) => {
  if (memberId === actorId) {
    throw new Error("Um administrador não apaga a própria conta.");
  }
  for (const [model, field] of staffRecordModels) {
    await staffDelegate(transaction, model).updateMany({
      where: { [field]: memberId },
      data: { [field]: actorId },
    });
  }
  await transferSharedSpaces(transaction, memberId);
  await transaction.communityPost.deleteMany({ where: { authorId: memberId } });
  // Grupos que ele criou e que ficaram vazios (sem outros membros, sem
  // publicações e sem coleção apontando para eles) não têm mais razão de existir.
  await transaction.communitySpace.deleteMany({
    where: {
      ownerId: memberId,
      members: { none: { memberId: { not: memberId } } },
      posts: { none: {} },
      assignmentBatches: { none: {} },
      contentCollections: { none: {} },
    },
  });
  await transaction.communityComment.deleteMany({
    where: { authorId: memberId },
  });
  await transaction.postVote.deleteMany({ where: { memberId } });
  await transaction.commentVote.deleteMany({ where: { memberId } });
  await transaction.communityBookmark.deleteMany({ where: { memberId } });
  await transaction.enrollment.deleteMany({ where: { memberId } });
  await transaction.lessonProgress.deleteMany({ where: { memberId } });
  await transaction.lessonAssetUpload.deleteMany({
    where: { actorId: memberId },
  });
  await transaction.member.delete({ where: { id: memberId } });
};

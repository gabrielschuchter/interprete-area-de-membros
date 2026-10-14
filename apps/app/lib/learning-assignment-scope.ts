import { MemberRole, type Prisma } from "@repo/database";
import { getGestaoCorrectionRecipientScope } from "./gestao-correction-scope";

export interface LearningAssignmentActor {
  readonly role: "ADMIN" | "TEACHER";
  readonly userId: string;
}

export const getLearningAssignmentRecipientScope = (
  actor: LearningAssignmentActor
): Prisma.MemberWhereInput => ({
  role: MemberRole.MEMBER,
  ...getGestaoCorrectionRecipientScope(actor),
});

export const getLearningAssignmentRecipientSearchWhere = (
  actor: LearningAssignmentActor,
  query: string
): Prisma.MemberWhereInput => ({
  AND: [
    getLearningAssignmentRecipientScope(actor),
    {
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        {
          profile: {
            is: {
              username: { contains: query, mode: "insensitive" },
            },
          },
        },
      ],
    },
  ],
});

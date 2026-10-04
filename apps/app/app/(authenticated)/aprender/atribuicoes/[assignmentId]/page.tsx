import { database, LearningAssignmentStatus } from "@repo/database";
import { notFound, redirect } from "next/navigation";
import { requireMemberId } from "@/lib/learning";
import { resolveLearningAssignmentTarget } from "@/lib/learning-assignments";

interface AssignedContentPageProperties {
  readonly params: Promise<{ readonly assignmentId: string }>;
}

const AssignedContentPage = async ({
  params,
}: AssignedContentPageProperties) => {
  const [{ assignmentId }, memberId] = await Promise.all([
    params,
    requireMemberId(),
  ]);
  const now = new Date();
  const href = await database.$transaction(async (transaction) => {
    const assignment = await transaction.activityAssignment.findFirst({
      where: {
        id: assignmentId,
        memberId,
        status: {
          in: [
            LearningAssignmentStatus.NEW,
            LearningAssignmentStatus.VIEWED,
            LearningAssignmentStatus.STARTED,
            LearningAssignmentStatus.COMPLETED,
          ],
        },
        revokedAt: null,
        AND: [
          { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: {
        id: true,
        status: true,
        targetId: true,
        targetType: true,
      },
    });
    if (!assignment) {
      return null;
    }
    const target = await resolveLearningAssignmentTarget(
      transaction,
      assignment.targetType,
      assignment.targetId
    );
    if (!target) {
      return null;
    }
    if (assignment.status === LearningAssignmentStatus.NEW) {
      const updated = await transaction.activityAssignment.updateMany({
        where: {
          id: assignment.id,
          memberId,
          status: LearningAssignmentStatus.NEW,
          revokedAt: null,
          AND: [
            { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        data: {
          status: LearningAssignmentStatus.VIEWED,
          viewedAt: now,
        },
      });
      if (updated.count !== 1) {
        return null;
      }
    }
    return target.href;
  });

  if (!href) {
    notFound();
  }
  redirect(href);
};

export default AssignedContentPage;

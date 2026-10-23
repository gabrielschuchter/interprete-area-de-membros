import "server-only";

import {
  BadgeCriterion,
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  ProgressStatus,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { evaluateMemberBadges } from "./badges";
import { getLearningAccessScope, hasLessonAccess } from "./content-access";
import { dispatchPendingNotifications } from "./notification-outbox-dispatch";

export interface LessonCompletionResult {
  readonly message?: string;
  readonly ok: boolean;
}

export const completeLessonForMember = async (
  memberId: string,
  lessonId: string
): Promise<LessonCompletionResult> => {
  const lesson = await database.lesson.findFirst({
    where: {
      id: lessonId,
      status: ContentStatus.PUBLISHED,
      module: {
        status: ContentStatus.PUBLISHED,
        course: {
          status: ContentStatus.PUBLISHED,
          OR: [
            { learningPathId: null },
            { learningPath: { is: { status: ContentStatus.PUBLISHED } } },
          ],
        },
      },
    },
    select: {
      slug: true,
      module: {
        select: {
          id: true,
          course: { select: { slug: true, id: true } },
        },
      },
    },
  });

  if (!lesson) {
    return { message: "A aula não está disponível.", ok: false };
  }

  // Progress is not an entitlement. A completion cannot create course access.
  const accessScope = await getLearningAccessScope(memberId);
  if (
    !hasLessonAccess(
      accessScope,
      lesson.module.course.id,
      lesson.module.id,
      lessonId
    )
  ) {
    return { message: "Você não tem acesso a esta aula.", ok: false };
  }

  const existingCompletion = await database.lessonProgress.findUnique({
    where: { memberId_lessonId: { memberId, lessonId } },
    select: { status: true },
  });
  if (existingCompletion?.status === ProgressStatus.COMPLETED) {
    return { message: "Aula concluída.", ok: true };
  }

  const completedAt = new Date();
  await database.$transaction(async (transaction) => {
    const existingProgress = await transaction.lessonProgress.findUnique({
      where: { memberId_lessonId: { memberId, lessonId } },
      select: { completedAt: true },
    });

    await transaction.lessonProgress.upsert({
      where: { memberId_lessonId: { memberId, lessonId } },
      create: {
        memberId,
        lessonId,
        status: ProgressStatus.COMPLETED,
        completedAt,
      },
      update: {
        status: ProgressStatus.COMPLETED,
        completedAt: existingProgress?.completedAt ?? completedAt,
      },
    });

    const incompleteAssignmentStates = {
      in: [
        LearningAssignmentStatus.NEW,
        LearningAssignmentStatus.VIEWED,
        LearningAssignmentStatus.STARTED,
      ],
    };
    await transaction.activityAssignment.updateMany({
      where: {
        memberId,
        targetType: LearningAssignmentTargetType.LESSON,
        targetId: lessonId,
        status: incompleteAssignmentStates,
        revokedAt: null,
      },
      data: { status: LearningAssignmentStatus.COMPLETED, completedAt },
    });

    const [moduleLessonCount, completedModuleLessonCount] = await Promise.all([
      transaction.lesson.count({
        where: { moduleId: lesson.module.id, status: ContentStatus.PUBLISHED },
      }),
      transaction.lessonProgress.count({
        where: {
          memberId,
          status: ProgressStatus.COMPLETED,
          lesson: {
            moduleId: lesson.module.id,
            status: ContentStatus.PUBLISHED,
          },
        },
      }),
    ]);
    if (
      moduleLessonCount > 0 &&
      completedModuleLessonCount >= moduleLessonCount
    ) {
      await transaction.activityAssignment.updateMany({
        where: {
          memberId,
          targetType: LearningAssignmentTargetType.MODULE,
          targetId: lesson.module.id,
          status: incompleteAssignmentStates,
          revokedAt: null,
        },
        data: { status: LearningAssignmentStatus.COMPLETED, completedAt },
      });
    }

    const [courseLessonCount, completedCourseLessonCount] = await Promise.all([
      transaction.lesson.count({
        where: {
          status: ContentStatus.PUBLISHED,
          module: {
            is: {
              courseId: lesson.module.course.id,
              status: ContentStatus.PUBLISHED,
            },
          },
        },
      }),
      transaction.lessonProgress.count({
        where: {
          memberId,
          status: ProgressStatus.COMPLETED,
          lesson: {
            module: {
              is: {
                courseId: lesson.module.course.id,
                status: ContentStatus.PUBLISHED,
              },
            },
          },
        },
      }),
    ]);
    if (
      courseLessonCount > 0 &&
      completedCourseLessonCount >= courseLessonCount
    ) {
      await transaction.activityAssignment.updateMany({
        where: {
          memberId,
          targetType: LearningAssignmentTargetType.COURSE,
          targetId: lesson.module.course.id,
          status: incompleteAssignmentStates,
          revokedAt: null,
        },
        data: { status: LearningAssignmentStatus.COMPLETED, completedAt },
      });
    }
    await evaluateMemberBadges(transaction, memberId, completedAt, {
      criteria: [
        BadgeCriterion.LESSONS_COMPLETED,
        BadgeCriterion.LEARNING_PATHS_COMPLETED,
      ],
      force: true,
    });
  });

  await dispatchPendingNotifications();
  revalidatePath("/cursos", "page");
  revalidatePath(`/cursos/${lesson.module.course.slug}`, "page");
  revalidatePath(`/cursos/${lesson.module.course.slug}/${lesson.slug}`, "page");
  return { message: "Aula concluída.", ok: true };
};

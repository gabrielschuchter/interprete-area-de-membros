"use server";

import {
  BadgeCriterion,
  ContentStatus,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  ProgressStatus,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { evaluateMemberBadges } from "@/lib/badges";
import { getLearningAccessScope, hasLessonAccess } from "@/lib/content-access";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

export interface CompleteLessonState {
  readonly message?: string;
  readonly ok: boolean;
}

export const completeLesson = async (
  _previousState: CompleteLessonState,
  formData: FormData
): Promise<CompleteLessonState> => {
  const lessonId = formData.get("lessonId");

  if (typeof lessonId !== "string" || lessonId.length === 0) {
    return { message: "Não foi possível identificar a aula.", ok: false };
  }

  const { userId } = await auth();

  if (!userId) {
    return { message: "Sua sessão expirou. Entre novamente.", ok: false };
  }

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
            {
              learningPath: {
                is: { status: ContentStatus.PUBLISHED },
              },
            },
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

  // Progress is not an entitlement. Never let a forged lesson id create an
  // enrollment and thereby turn a single completion into course-wide access.
  const accessScope = await getLearningAccessScope(userId);
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

  const completedAt = new Date();

  await database.$transaction(async (transaction) => {
    const existingProgress = await transaction.lessonProgress.findUnique({
      where: {
        memberId_lessonId: {
          memberId: userId,
          lessonId,
        },
      },
      select: { completedAt: true },
    });

    await transaction.lessonProgress.upsert({
      where: {
        memberId_lessonId: {
          memberId: userId,
          lessonId,
        },
      },
      create: {
        memberId: userId,
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
        memberId: userId,
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
          memberId: userId,
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
          memberId: userId,
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
          memberId: userId,
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
          memberId: userId,
          targetType: LearningAssignmentTargetType.COURSE,
          targetId: lesson.module.course.id,
          status: incompleteAssignmentStates,
          revokedAt: null,
        },
        data: { status: LearningAssignmentStatus.COMPLETED, completedAt },
      });
    }
    await evaluateMemberBadges(transaction, userId, completedAt, {
      criteria: [
        BadgeCriterion.LESSONS_COMPLETED,
        BadgeCriterion.LEARNING_PATHS_COMPLETED,
      ],
      force: true,
    });
  });

  await dispatchPendingNotifications();

  revalidatePath("/aprender", "page");
  revalidatePath(`/aprender/cursos/${lesson.module.course.slug}`, "page");
  revalidatePath(
    `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`,
    "page"
  );

  return { message: "Aula concluída.", ok: true };
};

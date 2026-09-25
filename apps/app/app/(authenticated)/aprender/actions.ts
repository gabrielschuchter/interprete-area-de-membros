"use server";

import { auth } from "@repo/auth/server";
import { ContentStatus, database, ProgressStatus } from "@repo/database";
import { revalidatePath } from "next/cache";
import { getLearningAccessScope, hasLessonAccess } from "@/lib/content-access";

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
  });

  revalidatePath("/aprender", "page");
  revalidatePath(`/aprender/cursos/${lesson.module.course.slug}`, "page");
  revalidatePath(
    `/aprender/cursos/${lesson.module.course.slug}/${lesson.slug}`,
    "page"
  );

  return { message: "Aula concluída.", ok: true };
};

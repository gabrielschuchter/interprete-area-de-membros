"use server";

import { auth } from "@/lib/auth";
import {
  completeLessonForMember,
  type LessonCompletionResult,
} from "@/lib/lesson-completion";

export interface CompleteLessonState extends LessonCompletionResult {}

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

  return completeLessonForMember(userId, lessonId);
};

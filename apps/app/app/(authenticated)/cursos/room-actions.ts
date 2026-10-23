"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  completeLessonForMember,
  type LessonCompletionResult,
  reopenLessonForMember,
} from "@/lib/lesson-completion";
import { mutationLog } from "@/lib/mutation-reliability";
import { setRecordingCompletion } from "@/lib/room-recording";

const setCompletedInput = z.object({
  completed: z.boolean(),
  lessonId: z.string().min(1).max(64),
});

// Absolute value, never a toggle: a retried request cannot flip it back.
export const setRoomLessonCompleted = async (
  input: unknown
): Promise<LessonCompletionResult> => {
  const parsed = setCompletedInput.safeParse(input);
  if (!parsed.success) {
    return { message: "Não foi possível identificar a aula.", ok: false };
  }
  const { userId } = await auth();
  if (!userId) {
    return { message: "Sua sessão expirou. Entre novamente.", ok: false };
  }
  const { completed, lessonId } = parsed.data;
  return completed
    ? completeLessonForMember(userId, lessonId)
    : reopenLessonForMember(userId, lessonId);
};

// Same contract as setRoomLessonCompleted, for the recording room.
export const setRoomRecordingCompleted = async (
  input: unknown
): Promise<LessonCompletionResult> => {
  const parsed = z
    .object({ assetId: z.string().min(1).max(64), completed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) {
    return { message: "Não foi possível identificar a gravação.", ok: false };
  }
  const { userId } = await auth();
  if (!userId) {
    return { message: "Sua sessão expirou. Entre novamente.", ok: false };
  }
  return setRecordingCompletion(
    userId,
    parsed.data.assetId,
    parsed.data.completed
  );
};

const videoIssueInput = z.object({
  assetId: z.string().min(1).max(64),
  code: z.enum(["yt_2", "yt_5", "yt_100", "yt_101", "yt_150", "timeout"]),
});

// No alert channel exists yet: a structured log is the whole effect, so the
// room never tells the student that the team was notified.
export const reportRoomVideoIssue = async (input: unknown) => {
  const parsed = videoIssueInput.safeParse(input);
  const { userId } = await auth();
  if (!(parsed.success && userId)) {
    return;
  }
  mutationLog({
    action: "room.video_issue",
    memberId: userId,
    resource: `${parsed.data.assetId}:${parsed.data.code}`,
    status: "error",
  });
};

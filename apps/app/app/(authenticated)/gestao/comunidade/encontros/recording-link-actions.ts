"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const revalidateRecordings = (meetingId: string) => {
  revalidatePath(`/gestao/comunidade/encontros/${meetingId}`);
  revalidatePath(`/encontros/${meetingId}`);
  revalidatePath("/gravacoes");
  revalidatePath("/comunidade/encontros");
};

/** Liga uma gravação importada a um encontro; quem tem acesso ao encontro a vê. */
export const linkMeetingRecording = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const meetingId = text(formData, "meetingId");
  const recordingId = text(formData, "recordingId");
  if (!(meetingId && recordingId)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const meeting = await database.meeting.findFirst({
    where: { id: meetingId },
    select: { id: true },
  });
  if (!meeting) {
    return;
  }
  const updated = await database.importedRecording.updateMany({
    where: { id: recordingId },
    data: { meetingId },
  });
  if (updated.count === 1) {
    await recordAuditEvent({
      actorId: actor.userId,
      aggregateId: meetingId,
      aggregateType: "Meeting",
      eventType: "gestao.meeting.recording_linked",
      payload: { recordingId },
    });
  }
  revalidateRecordings(meetingId);
};

export const unlinkMeetingRecording = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const meetingId = text(formData, "meetingId");
  const recordingId = text(formData, "recordingId");
  if (!(meetingId && recordingId)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const updated = await database.importedRecording.updateMany({
    where: { id: recordingId, meetingId },
    data: { meetingId: null },
  });
  if (updated.count === 1) {
    await recordAuditEvent({
      actorId: actor.userId,
      aggregateId: meetingId,
      aggregateType: "Meeting",
      eventType: "gestao.meeting.recording_unlinked",
      payload: { recordingId },
    });
  }
  revalidateRecordings(meetingId);
};

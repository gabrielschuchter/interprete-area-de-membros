"use server";

import { ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authorization";

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";

const safeUrl = (entry: string) => {
  try {
    const url = new URL(entry);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const safeTimezone = (entry: string) => {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: entry }).format();
    return entry;
  } catch {
    return null;
  }
};

export const createMeeting = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const startsAt = value(formData.get("startsAt"));
  const timezoneValue = value(formData.get("timezone")) || "America/Sao_Paulo";
  const timezone = safeTimezone(timezoneValue);
  const joinUrl = safeUrl(value(formData.get("joinUrl")));
  const recording = value(formData.get("recordingUrl"));
  const recordingUrl = recording ? safeUrl(recording) : null;
  const courseId = value(formData.get("courseId"));

  if (!(title && startsAt && joinUrl && timezone)) {
    return;
  }
  const parsedStartsAt = new Date(startsAt);
  if (Number.isNaN(parsedStartsAt.valueOf())) {
    return;
  }

  if (courseId) {
    const course = await database.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return;
    }
  }

  await database.meeting.create({
    data: {
      title,
      description: description || null,
      startsAt: parsedStartsAt,
      timezone,
      joinUrl,
      recordingUrl,
      teacherId: userId,
      courseId: courseId || null,
      status: ContentStatus.DRAFT,
    },
  });

  revalidatePath("/admin/meetings");
};

export const setMeetingStatus = async (formData: FormData) => {
  await requireStaff();
  const id = value(formData.get("id"));
  const nextStatus = value(formData.get("status"));

  if (
    !(id && Object.values(ContentStatus).includes(nextStatus as ContentStatus))
  ) {
    return;
  }
  await database.meeting.update({
    where: { id },
    data: { status: nextStatus as ContentStatus },
  });
  revalidatePath("/admin/meetings");
  revalidatePath("/encontros");
};

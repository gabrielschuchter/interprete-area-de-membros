"use server";

import { ContentStatus, database, MeetingKind } from "@repo/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authorization";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";
const MEMBER_ID_SPLIT = /[\n,]/;

const memberIds = (formData: FormData) =>
  [
    ...new Set(
      formData
        .getAll("memberIds")
        .flatMap((entry) =>
          typeof entry === "string" ? entry.split(MEMBER_ID_SPLIT) : []
        )
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ].slice(0, 200);

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

const validateRelations = async (
  courseId: string,
  relatedActivityId: string,
  relatedLibraryItemId: string
) => {
  const [course, activity, libraryItem] = await Promise.all([
    courseId
      ? database.course.findUnique({
          where: { id: courseId },
          select: { id: true },
        })
      : null,
    relatedActivityId
      ? database.activity.findUnique({
          where: { id: relatedActivityId },
          select: { id: true },
        })
      : null,
    relatedLibraryItemId
      ? database.libraryItem.findUnique({
          where: { id: relatedLibraryItemId },
          select: { id: true },
        })
      : null,
  ]);
  return Boolean(
    (!courseId || course) &&
      (!relatedActivityId || activity) &&
      (!relatedLibraryItemId || libraryItem)
  );
};

const validMembers = async (ids: string[]) => {
  if (ids.length === 0) {
    return [];
  }
  const rows = await database.member.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
};

const hasMeetingForAttempt = async (
  teacherId: string,
  idempotencyKey: string
) =>
  Boolean(
    await database.meeting.findUnique({
      where: { teacherId_idempotencyKey: { teacherId, idempotencyKey } },
      select: { id: true },
    })
  );

const parseMeetingDates = (startsAt: string, endsAt: string) => {
  const parsedStartsAt = new Date(startsAt);
  if (Number.isNaN(parsedStartsAt.valueOf())) {
    return null;
  }
  const parsedEndsAt = endsAt ? new Date(endsAt) : null;
  if (
    parsedEndsAt &&
    (Number.isNaN(parsedEndsAt.valueOf()) || parsedEndsAt <= parsedStartsAt)
  ) {
    return null;
  }
  return { parsedEndsAt, parsedStartsAt };
};

export const createMeeting = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "meeting.mutation",
    memberId: userId,
  });
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const startsAt = value(formData.get("startsAt"));
  const endsAt = value(formData.get("endsAt"));
  const kindValue = value(formData.get("kind"));
  const timezoneValue = value(formData.get("timezone")) || "America/Sao_Paulo";
  const timezone = safeTimezone(timezoneValue);
  const joinUrl = safeUrl(value(formData.get("joinUrl")));
  const recording = value(formData.get("recordingUrl"));
  const recordingUrl = recording ? safeUrl(recording) : null;
  const courseId = value(formData.get("courseId"));
  const recurrenceRule = value(formData.get("recurrenceRule"));
  const relatedActivityId = value(formData.get("relatedActivityId"));
  const relatedLibraryItemId = value(formData.get("relatedLibraryItemId"));
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));

  if (!(idempotencyKey && title && startsAt && joinUrl && timezone)) {
    return;
  }

  if (await hasMeetingForAttempt(userId, idempotencyKey)) {
    revalidatePath("/admin/meetings");
    return;
  }
  const parsedDates = parseMeetingDates(startsAt, endsAt);
  if (!parsedDates) {
    return;
  }
  const kind = Object.values(MeetingKind).includes(kindValue as MeetingKind)
    ? (kindValue as MeetingKind)
    : MeetingKind.OTHER;

  if (
    !(await validateRelations(
      courseId,
      relatedActivityId,
      relatedLibraryItemId
    ))
  ) {
    return;
  }

  const selectedMemberIds = await validMembers(memberIds(formData));
  try {
    await database.meeting.create({
      data: {
        title,
        description: description || null,
        startsAt: parsedDates.parsedStartsAt,
        endsAt: parsedDates.parsedEndsAt,
        timezone,
        joinUrl,
        recordingUrl,
        teacherId: userId,
        idempotencyKey,
        courseId: courseId || null,
        relatedActivityId: relatedActivityId || null,
        relatedLibraryItemId: relatedLibraryItemId || null,
        recurrenceRule: recurrenceRule || null,
        participants: {
          create: selectedMemberIds.map((memberId) => ({ memberId })),
        },
        status: ContentStatus.DRAFT,
        kind,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  revalidatePath("/admin/meetings");
};

export const updateMeeting = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "meeting.mutation",
    memberId: userId,
  });
  const id = value(formData.get("id"));
  const title = value(formData.get("title"));
  const description = value(formData.get("description"));
  const startsAt = value(formData.get("startsAt"));
  const endsAt = value(formData.get("endsAt"));
  const kindValue = value(formData.get("kind"));
  const timezone = safeTimezone(
    value(formData.get("timezone")) || "America/Sao_Paulo"
  );
  const joinUrl = safeUrl(value(formData.get("joinUrl")));
  const recording = value(formData.get("recordingUrl"));
  const recordingUrl = recording ? safeUrl(recording) : null;
  const courseId = value(formData.get("courseId"));
  const recurrenceRule = value(formData.get("recurrenceRule"));
  const relatedActivityId = value(formData.get("relatedActivityId"));
  const relatedLibraryItemId = value(formData.get("relatedLibraryItemId"));

  if (!(id && title && startsAt && joinUrl && timezone)) {
    return;
  }
  const parsedDates = parseMeetingDates(startsAt, endsAt);
  if (!parsedDates) {
    return;
  }
  if (
    !(await validateRelations(
      courseId,
      relatedActivityId,
      relatedLibraryItemId
    ))
  ) {
    return;
  }
  const selectedMemberIds = await validMembers(memberIds(formData));
  const kind = Object.values(MeetingKind).includes(kindValue as MeetingKind)
    ? (kindValue as MeetingKind)
    : MeetingKind.OTHER;

  await database.$transaction(async (transaction) => {
    await transaction.meeting.update({
      where: { id },
      data: {
        title,
        description: description || null,
        startsAt: parsedDates.parsedStartsAt,
        endsAt: parsedDates.parsedEndsAt,
        timezone,
        joinUrl,
        recordingUrl,
        teacherId: userId,
        courseId: courseId || null,
        relatedActivityId: relatedActivityId || null,
        relatedLibraryItemId: relatedLibraryItemId || null,
        recurrenceRule: recurrenceRule || null,
        kind,
      },
    });
    await transaction.meetingParticipant.deleteMany({
      where: { meetingId: id },
    });
    if (selectedMemberIds.length > 0) {
      await transaction.meetingParticipant.createMany({
        data: selectedMemberIds.map((memberId) => ({
          meetingId: id,
          memberId,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/admin/meetings");
  revalidatePath("/encontros");
  revalidatePath(`/encontros/${id}`);
};

export const setMeetingStatus = async (formData: FormData) => {
  const { userId } = await requireStaff();
  await consumeMutationRateLimit({
    action: "meeting.mutation",
    memberId: userId,
  });
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

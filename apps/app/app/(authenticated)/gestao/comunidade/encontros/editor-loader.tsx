import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  getGestaoMeetingAttendees,
  getGestaoMeetingEditor,
} from "@/lib/gestao-meetings";
import {
  gestaoMeetingInputParts,
  gestaoMeetingRecurrence,
  gestaoMeetingState,
} from "@/lib/gestao-meetings-domain";
import { GestaoCrumbTail } from "../../gestao-crumbs";
import { MeetingEditor, type MeetingEditorValues } from "./meeting-editor";

type EditorData = Awaited<ReturnType<typeof getGestaoMeetingEditor>>;
type EditorMeeting = NonNullable<EditorData["meeting"]>;

const toValues = (meeting: EditorMeeting, now: Date): MeetingEditorValues => {
  const start = gestaoMeetingInputParts(meeting.startsAt, meeting.timezone);
  const end = meeting.endsAt
    ? gestaoMeetingInputParts(meeting.endsAt, meeting.timezone)
    : null;
  const until = meeting.recurrenceUntil
    ? gestaoMeetingInputParts(meeting.recurrenceUntil, meeting.timezone)
    : null;
  const state = gestaoMeetingState(meeting, now);
  const publish =
    state === "scheduled" && meeting.publishedAt
      ? gestaoMeetingInputParts(meeting.publishedAt, meeting.timezone)
      : null;
  const started = meeting.startsAt <= now;
  return {
    activityId: meeting.relatedActivityId ?? "",
    attendanceCount: meeting._count.attendance,
    canRecordAttendance:
      started && (state === "published" || state === "archived"),
    courseId: meeting.courseId ?? "",
    date: start.date,
    description: meeting.description ?? "",
    end: end?.time ?? "",
    hasRecording:
      Boolean(meeting.recordingUrl) || meeting._count.recordings > 0,
    id: meeting.id,
    joinUrl: meeting.joinUrl,
    kind: meeting.kind,
    libraryItemId: meeting.relatedLibraryItemId ?? "",
    materialsPublished:
      meeting.relatedLibraryItem?.status === ContentStatus.PUBLISHED ||
      meeting.relatedActivity?.status === ContentStatus.PUBLISHED,
    publishDate: publish?.date ?? "",
    publishTime: publish?.time ?? "09:00",
    recordingUrl: meeting.recordingUrl ?? "",
    recurrence: gestaoMeetingRecurrence(meeting.recurrenceRule),
    start: start.time,
    state,
    timezone: meeting.timezone,
    title: meeting.title,
    until: until?.date ?? "",
  };
};

export const GestaoMeetingEditorPage = async ({
  meetingId,
  presetCohortId,
  presetDate,
}: {
  readonly meetingId: string | null;
  readonly presetCohortId?: string;
  readonly presetDate?: string;
}) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const data = await getGestaoMeetingEditor(actor, meetingId);
  if (meetingId && !data.meeting) {
    return null;
  }
  const now = new Date();
  const values = data.meeting ? toValues(data.meeting, now) : null;
  const attendees =
    values?.canRecordAttendance && data.meeting
      ? ((await getGestaoMeetingAttendees(data.meeting.id)) ?? [])
      : [];
  const preset =
    presetCohortId && data.cohorts.some((c) => c.id === presetCohortId)
      ? [presetCohortId]
      : [];
  return (
    <section className="gt-page gk-activities">
      <GestaoCrumbTail
        items={[{ label: data.meeting?.title ?? "Novo encontro" }]}
      />
      <MeetingEditor
        activities={data.activities}
        attendees={attendees}
        cohortIds={
          data.meeting
            ? data.meeting.cohortTargets.map((target) => target.cohortId)
            : preset
        }
        cohorts={data.cohorts}
        courses={data.courses}
        idempotencyKey={randomUUID()}
        libraryItems={data.libraryItems}
        meeting={values}
        people={data.people}
        presetDate={presetDate ?? ""}
      />
    </section>
  );
};

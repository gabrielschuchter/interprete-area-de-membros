import { meetingRecurrenceFromRule } from "./cohort-calendar-domain";

export interface MeetingCohortMembership {
  readonly includePastReadOnly: boolean;
  readonly joinedAt: Date;
  readonly lateJoinPolicy: "ALL_ACTIVE" | "FROM_JOIN";
}

export interface MeetingPublication {
  readonly createdAt?: Date;
  readonly endsAt?: Date | null;
  readonly publishedAt?: Date | null;
  readonly recurrenceRule?: string | null;
  readonly recurrenceUntil?: Date | null;
  readonly startsAt?: Date;
}

export const canReadMeetingCohortTarget = (
  meeting: MeetingPublication,
  target: { readonly assignedAt?: Date },
  membership: MeetingCohortMembership | undefined,
  occurrenceStartsAt?: Date
) => {
  if (
    !(membership && meeting.startsAt && meeting.createdAt && target.assignedAt)
  ) {
    return false;
  }
  const publishedAt = meeting.publishedAt ?? meeting.createdAt;
  const availableAt = Math.max(
    publishedAt.getTime(),
    target.assignedAt.getTime()
  );
  if (membership.lateJoinPolicy === "FROM_JOIN") {
    return availableAt >= membership.joinedAt.getTime();
  }
  if (membership.includePastReadOnly) {
    return true;
  }
  if (
    !occurrenceStartsAt &&
    meetingRecurrenceFromRule(meeting.recurrenceRule) !== "NONE" &&
    (!meeting.recurrenceUntil || meeting.recurrenceUntil >= membership.joinedAt)
  ) {
    return true;
  }
  const endsAt = meeting.endsAt ?? meeting.startsAt;
  const occurrenceEnd = occurrenceStartsAt
    ? new Date(
        endsAt.getTime() +
          occurrenceStartsAt.getTime() -
          meeting.startsAt.getTime()
      )
    : endsAt;
  return occurrenceEnd >= membership.joinedAt;
};

import "server-only";
import { ContentStatus, database } from "@repo/database";
import type { GestaoActor } from "./gestao-authorization";
import { getGestaoCorrectionCohortScope } from "./gestao-correction-scope";
import {
  type GestaoMeetingState,
  type GestaoMeetingTab,
  gestaoMeetingAudienceLabel,
  gestaoMeetingHourLabel,
  gestaoMeetingIsUpcoming,
  gestaoMeetingState,
  gestaoMeetingSubline,
  gestaoMeetingTabMatches,
  gestaoMeetingTile,
} from "./gestao-meetings-domain";

const maxMeetings = 400;

export interface GestaoMeetingRow {
  readonly day: string;
  readonly id: string;
  readonly month: string;
  readonly startsAt: Date;
  readonly state: GestaoMeetingState;
  readonly subline: string;
  readonly title: string;
  readonly upcoming: boolean;
  readonly withoutRecording: boolean;
}

export const getGestaoMeetingList = async (tab: GestaoMeetingTab) => {
  const now = new Date();
  const meetings = await database.meeting.findMany({
    where: { demoKey: null },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: maxMeetings,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      status: true,
      publishedAt: true,
      recurrenceRule: true,
      recurrenceUntil: true,
      recordingUrl: true,
      course: { select: { title: true } },
      cohortTargets: {
        where: { revokedAt: null },
        select: { cohort: { select: { name: true } } },
      },
      _count: { select: { participants: true, recordings: true } },
    },
  });

  const rows = meetings.map((meeting) => {
    const state = gestaoMeetingState(meeting, now);
    const upcoming = gestaoMeetingIsUpcoming(meeting, now);
    const tile = gestaoMeetingTile(meeting.startsAt, meeting.timezone);
    const courseTitle = meeting.course?.title ?? null;
    const audience = gestaoMeetingAudienceLabel({
      cohorts: meeting.cohortTargets.map((target) => target.cohort.name),
      courseTitle,
      people: meeting._count.participants,
    });
    const row: GestaoMeetingRow = {
      day: tile.day,
      id: meeting.id,
      month: tile.month,
      startsAt: meeting.startsAt,
      state,
      subline: gestaoMeetingSubline({
        audience,
        courseTitle,
        hour: gestaoMeetingHourLabel(meeting.startsAt, meeting.timezone),
      }),
      title: meeting.title,
      upcoming,
      withoutRecording:
        state === "published" &&
        !upcoming &&
        !meeting.recordingUrl &&
        meeting._count.recordings === 0,
    };
    return row;
  });

  const unpublished = rows.filter(
    (row) => row.state === "draft" || row.state === "scheduled"
  ).length;
  const visible = rows.filter((row) =>
    gestaoMeetingTabMatches(tab, row.state, row.upcoming)
  );
  // Próximos em ordem cronológica; passados do mais recente para o mais antigo.
  const ordered = tab === "past" ? [...visible].reverse() : visible;
  return {
    drafts: unpublished,
    rows: ordered,
    withoutRecording: rows.filter((row) => row.withoutRecording).length,
  };
};

export interface GestaoMeetingCohortOption {
  readonly id: string;
  readonly name: string;
  readonly students: number;
}

export const getGestaoMeetingCohorts = async (
  actor: GestaoActor
): Promise<GestaoMeetingCohortOption[]> => {
  const cohorts = await database.cohort.findMany({
    where: getGestaoCorrectionCohortScope(actor),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          memberships: {
            where: {
              status: "ACTIVE",
              leftAt: null,
              member: { is: { role: "MEMBER", deactivatedAt: null } },
            },
          },
        },
      },
    },
  });
  return cohorts.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    students: cohort._count.memberships,
  }));
};

const editorMeetingSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  joinUrl: true,
  recordingUrl: true,
  status: true,
  publishedAt: true,
  kind: true,
  recurrenceRule: true,
  recurrenceUntil: true,
  courseId: true,
  relatedActivityId: true,
  relatedLibraryItemId: true,
  updatedAt: true,
  participants: { select: { memberId: true } },
  cohortTargets: {
    where: { revokedAt: null },
    select: { cohortId: true },
  },
  relatedLibraryItem: { select: { status: true } },
  relatedActivity: { select: { status: true } },
  _count: { select: { attendance: true, recordings: true } },
} as const;

export const getGestaoMeetingEditor = async (
  actor: GestaoActor,
  id: string | null
) => {
  const [meeting, cohorts, courses, activities, libraryItems] =
    await Promise.all([
      id
        ? database.meeting.findFirst({
            where: { id, demoKey: null },
            select: editorMeetingSelect,
          })
        : null,
      getGestaoMeetingCohorts(actor),
      database.course.findMany({
        where: { status: { not: ContentStatus.ARCHIVED } },
        orderBy: { title: "asc" },
        take: 200,
        select: { id: true, title: true },
      }),
      database.activity.findMany({
        orderBy: { title: "asc" },
        take: 300,
        select: { id: true, title: true },
      }),
      database.libraryItem.findMany({
        orderBy: { title: "asc" },
        take: 300,
        select: { id: true, title: true },
      }),
    ]);
  const people = meeting
    ? await database.member.findMany({
        where: {
          id: { in: meeting.participants.map((entry) => entry.memberId) },
        },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true },
      })
    : [];
  return {
    activities,
    cohorts,
    courses,
    libraryItems,
    meeting,
    people: people.map((person) => ({
      id: person.id,
      name: person.displayName ?? "Aluno",
    })),
  };
};

/** Quem pode ter presença registrada: participantes individuais e alunos das turmas. */
export const getGestaoMeetingAttendees = async (meetingId: string) => {
  const meeting = await database.meeting.findUnique({
    where: { id: meetingId },
    select: {
      participants: { select: { memberId: true } },
      cohortTargets: {
        where: { revokedAt: null },
        select: { cohortId: true },
      },
      attendance: { select: { memberId: true, isPresent: true } },
    },
  });
  if (!meeting) {
    return null;
  }
  const memberships = meeting.cohortTargets.length
    ? await database.cohortMembership.findMany({
        where: {
          cohortId: { in: meeting.cohortTargets.map((t) => t.cohortId) },
          status: "ACTIVE",
          leftAt: null,
          member: { is: { role: "MEMBER", deactivatedAt: null } },
        },
        select: { memberId: true },
      })
    : [];
  const ids = [
    ...new Set([
      ...meeting.participants.map((entry) => entry.memberId),
      ...memberships.map((entry) => entry.memberId),
    ]),
  ];
  const members = await database.member.findMany({
    where: { id: { in: ids }, deactivatedAt: null },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  const present = new Set(
    meeting.attendance
      .filter((entry) => entry.isPresent)
      .map((entry) => entry.memberId)
  );
  return members.map((member) => ({
    id: member.id,
    name: member.displayName ?? "Aluno",
    present: present.has(member.id),
  }));
};

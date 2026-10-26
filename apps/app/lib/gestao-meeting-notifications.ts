import "server-only";
import { database } from "@repo/database";
import { createNotification, notificationTypes } from "./notifications";

const maxRecipients = 5000;

/** Participantes individuais e alunos ativos das turmas do encontro. */
const meetingRecipientIds = async (meeting: {
  readonly cohortTargets: readonly { readonly cohortId: string }[];
  readonly participants: readonly { readonly memberId: string }[];
}) => {
  const cohortIds = meeting.cohortTargets.map((target) => target.cohortId);
  const memberships = cohortIds.length
    ? await database.cohortMembership.findMany({
        where: {
          cohortId: { in: cohortIds },
          status: "ACTIVE",
          leftAt: null,
          member: { is: { role: "MEMBER", deactivatedAt: null } },
        },
        select: { memberId: true },
        take: maxRecipients,
      })
    : [];
  return [
    ...new Set([
      ...meeting.participants.map((entry) => entry.memberId),
      ...memberships.map((entry) => entry.memberId),
    ]),
  ].slice(0, maxRecipients);
};

/**
 * Aviso interno "Novo encontro: título, data" para quem foi escolhido como
 * participante. Sem participantes, o encontro segue a visibilidade do curso e
 * ninguém é avisado individualmente. Repetir a chamada não duplica avisos.
 */
export const notifyGestaoMeetingPublished = async (
  meetingId: string,
  actorId: string | null
) => {
  const meeting = await database.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      timezone: true,
      participants: { select: { memberId: true } },
      cohortTargets: {
        where: { revokedAt: null },
        select: { cohortId: true },
      },
    },
  });
  if (!meeting) {
    return 0;
  }
  const recipients = await meetingRecipientIds(meeting);
  const when = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: meeting.timezone,
  }).format(meeting.startsAt);
  const results = await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        actorId,
        body: when,
        dedupeKey: `meeting-published:${recipientId}:${meeting.id}`,
        entityId: meeting.id,
        entityType: "MEETING",
        href: `/encontros/${meeting.id}`,
        recipientId,
        title: `Novo encontro: ${meeting.title}`,
        type: notificationTypes.announcement,
      })
    )
  );
  return results.filter(Boolean).length;
};

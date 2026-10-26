import "server-only";
import { ContentStatus, database } from "@repo/database";
import { notifyGestaoMeetingPublished } from "./gestao-meeting-notifications";

/**
 * Encontro agendado é um rascunho com data de publicação no futuro. Quando a
 * data chega, vira publicado e os participantes são avisados; quem chama
 * decide o momento (abertura da agenda, página de encontros do aluno ou o
 * processamento diário).
 */
export const publishDueGestaoMeetings = async (now = new Date()) => {
  const due = await database.meeting.findMany({
    where: {
      status: ContentStatus.DRAFT,
      publishedAt: { not: null, lte: now },
    },
    select: { id: true },
    take: 100,
  });
  if (due.length === 0) {
    return 0;
  }
  const ids = due.map((meeting) => meeting.id);
  const result = await database.meeting.updateMany({
    where: { id: { in: ids }, status: ContentStatus.DRAFT },
    data: { status: ContentStatus.PUBLISHED },
  });
  for (const id of ids) {
    await notifyGestaoMeetingPublished(id, null);
  }
  return result.count;
};

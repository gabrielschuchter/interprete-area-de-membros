import "server-only";

import { randomUUID } from "node:crypto";
import { BadgeCriterion, database, StudyActivityKind } from "@repo/database";
import { z } from "zod";
import { evaluateMemberBadges } from "./badges";
import { localStudyDayStart, studyLocalDayKey } from "./study-periods";
import {
  MANUAL_MAX_MINUTES,
  MANUAL_MAX_MINUTES_PER_DAY,
  MANUAL_MIN_MINUTES,
  MANUAL_SESSION_PREFIX,
  manualClientSessionId,
  shelfGroups,
} from "./study-week-shelf-model";

const manualEntrySchema = z.object({
  group: z.enum(shelfGroups),
  minutes: z.number().int().min(MANUAL_MIN_MINUTES).max(MANUAL_MAX_MINUTES),
});

/** O banco só aceita intervalos de até 30 s (como o cronômetro grava). */
const MAX_INTERVAL_SECONDS = 30;

const manualIntervals = (
  memberId: string,
  startedAt: Date,
  seconds: number
) => {
  const rows: Array<{
    endedAt: Date;
    isPlayback: boolean;
    memberId: string;
    seconds: number;
    sequence: number;
    startedAt: Date;
  }> = [];
  let cursor = startedAt;
  let left = seconds;
  while (left > 0) {
    const chunk = Math.min(MAX_INTERVAL_SECONDS, left);
    const endedAt = new Date(cursor.getTime() + chunk * 1000);
    rows.push({
      memberId,
      sequence: rows.length,
      startedAt: cursor,
      endedAt,
      seconds: chunk,
      isPlayback: false,
    });
    left -= chunk;
    cursor = endedAt;
  }
  return rows;
};

/**
 * Lançamento manual de estudo (papel, aula presencial, leitura fora da
 * plataforma). Grava uma sessão e um intervalo no mesmo modelo do cronômetro
 * pessoal: por isso conta na meta, nas conquistas e nas sequências sem mudar
 * nenhuma consulta existente. O prefixo `manual:` em `clientSessionId` é o que
 * permite listar e desfazer só os lançamentos manuais.
 */
export const addManualStudyEntry = async (memberId: string, input: unknown) => {
  const parsed = manualEntrySchema.parse(input);
  const now = new Date();
  const dayStart = localStudyDayStart(studyLocalDayKey(now));
  const seconds = parsed.minutes * 60;
  // O intervalo termina agora; se cruzar a meia-noite, começa no início do dia
  // para a sessão contar sempre no dia (e na semana) em que foi lançada.
  const startedAt = new Date(
    Math.max(now.getTime() - seconds * 1000, dayStart.getTime())
  );
  const endedAt = new Date(startedAt.getTime() + seconds * 1000);
  const intervals = manualIntervals(memberId, startedAt, seconds);

  const entry = await database.$transaction(async (transaction) => {
    const today = await transaction.studyTrackingSession.findMany({
      where: {
        memberId,
        clientSessionId: { startsWith: MANUAL_SESSION_PREFIX },
        startedAt: { gte: dayStart },
      },
      select: { intervals: { select: { seconds: true } } },
    });
    const usedMinutes = Math.round(
      today.reduce(
        (sum, session) =>
          sum + session.intervals.reduce((acc, item) => acc + item.seconds, 0),
        0
      ) / 60
    );
    if (usedMinutes + parsed.minutes > MANUAL_MAX_MINUTES_PER_DAY) {
      throw new Error(
        "Limite de 8 horas de lançamentos manuais por dia atingido."
      );
    }
    const session = await transaction.studyTrackingSession.create({
      data: {
        memberId,
        clientSessionId: manualClientSessionId(parsed.group, randomUUID()),
        activityKind: StudyActivityKind.PERSONAL_TIMER,
        resourceId: null,
        lastSequence: intervals.length - 1,
        lastHeartbeatAt: endedAt,
        startedAt,
        endedAt,
        intervals: { createMany: { data: intervals } },
      },
      select: { id: true },
    });
    await evaluateMemberBadges(transaction, memberId, now, {
      criteria: [
        BadgeCriterion.STUDY_MINUTES,
        BadgeCriterion.STUDY_STREAK_DAYS,
        BadgeCriterion.STUDY_GOALS_MET,
      ],
    });
    return { id: session.id };
  });
  return entry;
};

/** Desfaz um lançamento manual do próprio membro; nunca toca sessões reais. */
export const deleteManualStudyEntry = async (
  memberId: string,
  sessionId: string
) => {
  const id = z.string().min(1).max(64).parse(sessionId);
  const removed = await database.studyTrackingSession.deleteMany({
    where: {
      id,
      memberId,
      clientSessionId: { startsWith: MANUAL_SESSION_PREFIX },
    },
  });
  if (removed.count === 0) {
    throw new Error("Lançamento não encontrado.");
  }
  return { id };
};

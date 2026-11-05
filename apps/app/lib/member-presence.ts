import "server-only";

import { database, Prisma } from "@repo/database";

/**
 * Presença na plataforma para a meta coletiva (05/11/2026).
 *
 * O navegador manda um sinal a cada minuto enquanto a aba está visível e a
 * pessoa mexeu na página há pouco. Cada sinal é um único upsert na linha da
 * hora corrente: o servidor credita o tempo desde o sinal anterior, no máximo
 * 75 s (um intervalo e um atraso de rede), e o primeiro da hora vale 30 s.
 * Várias abas não somam em dobro, porque o crédito sai do relógio do servidor.
 * A margem de erro é de até um intervalo por sessão, para mais (contagem
 * otimista, de propósito).
 */
export const PRESENCE_MAX_CREDIT_SECONDS = 75;
export const PRESENCE_FIRST_BEAT_SECONDS = 30;

export const recordMemberPresence = async (
  memberId: string,
  now = new Date()
) => {
  const hourStart = new Date(now);
  hourStart.setUTCMinutes(0, 0, 0);
  await database.$executeRaw(Prisma.sql`
    INSERT INTO "MemberPresenceHour" ("memberId", "hourStart", "seconds", "lastBeatAt")
    VALUES (${memberId}, ${hourStart}, ${PRESENCE_FIRST_BEAT_SECONDS}, ${now})
    ON CONFLICT ("memberId", "hourStart") DO UPDATE SET
      "seconds" = LEAST(
        3600,
        "MemberPresenceHour"."seconds" + LEAST(
          ${PRESENCE_MAX_CREDIT_SECONDS},
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz - "MemberPresenceHour"."lastBeatAt")))::int)
        )
      ),
      "lastBeatAt" = GREATEST("MemberPresenceHour"."lastBeatAt", ${now}::timestamptz)
  `);
};

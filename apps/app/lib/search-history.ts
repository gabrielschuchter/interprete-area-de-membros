import "server-only";

import { database } from "@repo/database";
import { z } from "zod";

const querySchema = z.string().trim().min(2).max(80);
const historyIdSchema = z.string().trim().min(1).max(255);

const normalizeQuery = (query: string) =>
  query.replace(/\s+/g, " ").trim().slice(0, 80);

export const getSearchHistory = (memberId: string) =>
  database.globalSearchHistory.findMany({
    where: { memberId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
    select: { id: true, query: true, createdAt: true },
  });

export const recordSearchHistory = (memberId: string, rawQuery: unknown) => {
  const query = normalizeQuery(querySchema.parse(rawQuery));
  const normalizedQuery = query.toLocaleLowerCase("pt-BR");
  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${memberId}, 0))::text
    `;
    await transaction.globalSearchHistory.upsert({
      where: { memberId_normalizedQuery: { memberId, normalizedQuery } },
      create: { memberId, query, normalizedQuery },
      update: { query, createdAt: new Date() },
    });
    const retained = await transaction.globalSearchHistory.findMany({
      where: { memberId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 10,
      select: { id: true },
    });
    if (retained.length > 0) {
      await transaction.globalSearchHistory.deleteMany({
        where: { memberId, id: { in: retained.map(({ id }) => id) } },
      });
    }
    return transaction.globalSearchHistory.findMany({
      where: { memberId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: { id: true, query: true, createdAt: true },
    });
  });
};

export const removeSearchHistoryEntry = async (memberId: string, id: unknown) =>
  database.globalSearchHistory.deleteMany({
    where: { memberId, id: historyIdSchema.parse(id) },
  });

export const clearSearchHistory = (memberId: string) =>
  database.globalSearchHistory.deleteMany({ where: { memberId } });

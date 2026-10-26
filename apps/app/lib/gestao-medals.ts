import "server-only";
import { database } from "@repo/database";
import { parseMedalStatus } from "./gestao-medals-domain";

export const listGestaoMedals = async (input: {
  readonly query?: string;
  readonly status?: string;
}) => {
  const query = (input.query ?? "").trim().slice(0, 80);
  const status = parseMedalStatus(input.status);
  return await database.badgeDefinition.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ status: "asc" }, { criterion: "asc" }, { threshold: "asc" }],
    take: 200,
    select: {
      _count: { select: { awards: true } },
      criterion: true,
      id: true,
      status: true,
      threshold: true,
      title: true,
    },
  });
};

export const getGestaoMedal = (id: string) =>
  database.badgeDefinition.findUnique({
    where: { id },
    select: {
      _count: { select: { awards: true } },
      criterion: true,
      description: true,
      id: true,
      revisions: {
        orderBy: { version: "desc" },
        take: 12,
        select: {
          createdAt: true,
          criterion: true,
          description: true,
          threshold: true,
          title: true,
          version: true,
        },
      },
      status: true,
      threshold: true,
      title: true,
      updatedAt: true,
      version: true,
    },
  });

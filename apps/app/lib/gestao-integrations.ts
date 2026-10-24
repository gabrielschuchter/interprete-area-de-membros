import "server-only";
import { database } from "@repo/database";
import { env } from "@/env";
import { requireGestaoAction } from "./gestao-authorization";

const problemStatuses = [
  "PRIVATE_OR_NOT_FOUND",
  "EMBEDDING_DISABLED",
  "INVALID",
];
const listSize = 20;

export const youtubeStatusLabels: Readonly<Record<string, string>> = {
  PUBLIC: "Público",
  UNLISTED: "Não listado",
  PRIVATE_OR_NOT_FOUND: "Privado ou removido",
  EMBEDDING_DISABLED: "Sem incorporação",
  INVALID: "Endereço inválido",
};

export const getGestaoYouTubeIntegration = async () => {
  await requireGestaoAction("integrations.manage");
  const where = { mediaProvider: "YOUTUBE" as const };
  const [grouped, unchecked, problems, lastChecked] = await Promise.all([
    database.lessonAsset.groupBy({
      by: ["youtubeVerificationStatus"],
      where,
      _count: { _all: true },
    }),
    database.lessonAsset.count({
      where: { ...where, youtubeCheckedAt: null },
    }),
    database.lessonAsset.findMany({
      where: {
        ...where,
        youtubeVerificationStatus: { in: problemStatuses },
      },
      orderBy: [{ youtubeCheckedAt: "desc" }, { id: "asc" }],
      take: listSize,
      select: {
        id: true,
        youtubeVerificationStatus: true,
        youtubeCheckedAt: true,
        lesson: {
          select: {
            title: true,
            status: true,
            module: {
              select: { course: { select: { id: true, title: true } } },
            },
          },
        },
      },
    }),
    database.lessonAsset.aggregate({
      where,
      _max: { youtubeCheckedAt: true },
    }),
  ]);
  let mode: "api-key" | "development" | "none" = "none";
  if (env.YOUTUBE_DEVELOPMENT_ADAPTER === "true") {
    mode = "development";
  } else if (env.YOUTUBE_API_KEY) {
    mode = "api-key";
  }
  return {
    mode,
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    unchecked,
    lastCheckedAt: lastChecked._max.youtubeCheckedAt,
    byStatus: grouped
      .map((row) => ({
        status: row.youtubeVerificationStatus,
        label: row.youtubeVerificationStatus
          ? (youtubeStatusLabels[row.youtubeVerificationStatus] ??
            row.youtubeVerificationStatus)
          : "Ainda não verificado",
        count: row._count._all,
      }))
      .sort((left, right) => right.count - left.count),
    problems: problems.map((asset) => ({
      id: asset.id,
      lesson: asset.lesson.title,
      published: asset.lesson.status === "PUBLISHED",
      course: asset.lesson.module.course,
      status:
        youtubeStatusLabels[asset.youtubeVerificationStatus ?? ""] ??
        "Indisponível",
      checkedAt: asset.youtubeCheckedAt,
    })),
  };
};

import "server-only";

import { ContentStatus, database, LessonAssetScope } from "@repo/database";
import { getLearningAccessScope } from "./content-access";

export const getMemberLearningAssets = async (memberId: string) => {
  const scope = await getLearningAccessScope(memberId);

  return database.lessonAsset.findMany({
    where: {
      scope: LessonAssetScope.INDIVIDUAL,
      ...(scope.fullAccess
        ? {}
        : {
            OR: [
              { ownerMemberId: memberId },
              ...(scope.assetIds.size
                ? [{ id: { in: [...scope.assetIds] } }]
                : []),
            ],
          }),
      lesson: {
        status: ContentStatus.PUBLISHED,
        module: {
          status: ContentStatus.PUBLISHED,
          course: { status: ContentStatus.PUBLISHED },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      scope: true,
      mimeType: true,
      lesson: {
        select: {
          id: true,
          title: true,
          slug: true,
          module: {
            select: {
              title: true,
              course: { select: { title: true, slug: true } },
            },
          },
        },
      },
    },
  });
};

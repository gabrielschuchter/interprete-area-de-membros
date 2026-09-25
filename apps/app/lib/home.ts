import "server-only";

import { database } from "@repo/database";
import { getPublishedActivities } from "./activities";
import { getCommunitySpaces } from "./community";
import { getLearningAccessScope } from "./content-access";
import { getPublishedLearningPaths } from "./learning";
import { getMeetings } from "./meetings";

export const getHomeData = async (memberId: string) => {
  const accessScope = getLearningAccessScope(memberId);
  const [paths, activities, meetings, spaces, latestFeedback] =
    await Promise.all([
      getPublishedLearningPaths(memberId, undefined, accessScope),
      getPublishedActivities(memberId, accessScope),
      getMeetings(memberId, accessScope),
      getCommunitySpaces(),
      database.activitySubmission.findFirst({
        where: {
          memberId,
          status: "REVIEWED",
          feedback: { isNot: null },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          activity: { select: { title: true, slug: true } },
          feedback: { select: { updatedAt: true } },
        },
      }),
    ]);

  return { paths, activities, meetings, spaces, latestFeedback };
};

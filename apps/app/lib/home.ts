import "server-only";

import { database } from "@repo/database";
import { getPublishedActivities } from "./activities";
import { getLatestCommunityPost } from "./community";
import { getLearningAccessScope } from "./content-access";
import { getHomeLearningSummary } from "./learning";
import { getUpcomingMeetings } from "./meetings";

export const getHomeData = async (memberId: string) => {
  const accessScope = getLearningAccessScope(memberId);
  const [courses, activities, upcomingMeetings, recentPost, latestFeedback] =
    await Promise.all([
      getHomeLearningSummary(memberId, accessScope),
      getPublishedActivities(memberId, accessScope),
      getUpcomingMeetings(memberId, accessScope),
      getLatestCommunityPost(),
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

  return {
    courses,
    activities,
    meetings: { upcoming: upcomingMeetings },
    recentPost,
    latestFeedback,
  };
};

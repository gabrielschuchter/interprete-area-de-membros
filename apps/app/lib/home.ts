import "server-only";

import { database } from "@repo/database";
import { getPublishedActivities } from "./activities";
import { getLatestCommunityPost } from "./community";
import { getLearningAccessScope } from "./content-access";
import { getHomeBlockConfigurations } from "./home-config";
import { getHomeLearningSummary } from "./learning";
import { getUpcomingMeetings } from "./meetings";
import { getProductConfig } from "./product-config";
import { getMemberRecordingLibrary } from "./recordings";

export const getHomeData = async (memberId: string) => {
  const accessScope = getLearningAccessScope(memberId);
  const [
    courses,
    activities,
    upcomingMeetings,
    recentPost,
    latestFeedback,
    recordings,
    productConfig,
    homeBlocks,
  ] = await Promise.all([
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
    getMemberRecordingLibrary(memberId),
    getProductConfig(),
    getHomeBlockConfigurations(),
  ]);

  return {
    courses,
    activities,
    meetings: { upcoming: upcomingMeetings },
    recordings,
    homeBlocks,
    productConfig: {
      ...productConfig,
      showLearnNavigation:
        productConfig.showLearnNavigation &&
        courses.some((course) =>
          course.modules.some((module) => module.lessons.length > 0)
        ),
    },
    recentPost,
    latestFeedback,
  };
};

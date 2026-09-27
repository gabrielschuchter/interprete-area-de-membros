import "server-only";

import { database, HomeBlockType } from "@repo/database";
import { getPublishedActivities } from "./activities";
import { getLatestCommunityPost } from "./community";
import { getLearningAccessScope } from "./content-access";
import { getPublishedCollectionsForMember } from "./content-collections";
import { getHomeBlockConfigurations } from "./home-config";
import { getHomeLearningSummary } from "./learning";
import { getUpcomingMeetings } from "./meetings";
import { getProductConfig } from "./product-config";
import { getMemberContinueWatching } from "./recordings";

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
    getMemberContinueWatching(memberId),
    getProductConfig(),
    getHomeBlockConfigurations(),
  ]);

  const collections = homeBlocks.some(
    (block) =>
      block.enabled &&
      block.type === HomeBlockType.COLLECTION &&
      Boolean(block.collectionId)
  )
    ? await getPublishedCollectionsForMember(memberId, 20)
    : [];

  return {
    courses,
    activities,
    meetings: { upcoming: upcomingMeetings },
    recordings,
    homeBlocks,
    collections,
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

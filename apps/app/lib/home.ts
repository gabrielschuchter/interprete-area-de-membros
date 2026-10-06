import "server-only";

import { database, HomeBlockType } from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { getPublishedActivities } from "./activities";
import { getLatestCommunityPost } from "./community";
import { getPublishedCollectionsForMember } from "./content-collections";
import { getHomeBlockConfigurations } from "./home-config";
import { getHomeLearningSummary } from "./learning";
import { getUpcomingMeetings } from "./meetings";
import { getProductConfig } from "./product-config";
import { getMemberContinueWatching } from "./recordings";

export const getHomeData = (memberId: string) =>
  tracePerformance("member.home.data", async () => {
    const [homeBlocks, productConfig] = await Promise.all([
      getHomeBlockConfigurations(),
      getProductConfig(),
    ]);
    const enabledBlocks = new Set(
      homeBlocks.filter((block) => block.enabled).map((block) => block.type)
    );
    const hasBlock = (type: HomeBlockType) => enabledBlocks.has(type);
    const collectionBlock = homeBlocks.find(
      (block) => block.type === HomeBlockType.COLLECTION
    );
    const [
      courses,
      activities,
      upcomingMeetings,
      recentPost,
      latestFeedback,
      recordings,
      collections,
    ] = await Promise.all([
      hasBlock(HomeBlockType.ASYNC_LEARNING)
        ? getHomeLearningSummary(memberId)
        : [],
      hasBlock(HomeBlockType.PENDING_ACTIVITY)
        ? getPublishedActivities(memberId)
        : [],
      hasBlock(HomeBlockType.NEXT_MEETING) ||
      hasBlock(HomeBlockType.PREPARATION)
        ? getUpcomingMeetings(memberId)
        : [],
      hasBlock(HomeBlockType.COMMUNITY) ? getLatestCommunityPost() : null,
      hasBlock(HomeBlockType.FEEDBACK)
        ? database.activitySubmission.findFirst({
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
          })
        : null,
      hasBlock(HomeBlockType.CONTINUE_WATCHING)
        ? getMemberContinueWatching(memberId)
        : null,
      collectionBlock?.enabled && collectionBlock.collectionId
        ? getPublishedCollectionsForMember(memberId, 20)
        : [],
    ]);

    return {
      courses,
      activities,
      meetings: { upcoming: upcomingMeetings },
      recordings: { continueWatching: recordings?.continueWatching ?? [] },
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
  });

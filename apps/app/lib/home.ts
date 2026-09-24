import "server-only";

import { getPublishedActivities } from "./activities";
import { getCommunitySpaces } from "./community";
import { getPublishedLearningPaths } from "./learning";
import { getMeetings } from "./meetings";

export const getHomeData = async (memberId: string) => {
  const [paths, activities, meetings, spaces] = await Promise.all([
    getPublishedLearningPaths(memberId),
    getPublishedActivities(memberId),
    getMeetings(),
    getCommunitySpaces(),
  ]);

  return { paths, activities, meetings, spaces };
};

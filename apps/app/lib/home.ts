import "server-only";

import { database } from "@repo/database";
import { getPublishedActivities } from "./activities";
import { getCommunitySpaces } from "./community";
import { getLearningAccessScope } from "./content-access";
import { getPublishedLearningPaths } from "./learning";
import { getMeetings } from "./meetings";

export const getHomeData = async (memberId: string) => {
  const startedAt = performance.now();
  const timed = async <T>(label: string, operation: () => Promise<T>) => {
    const operationStartedAt = performance.now();
    const result = await operation();
    console.error(
      `[PERF_HOME] ${label}=${(performance.now() - operationStartedAt).toFixed(1)}ms`,
    );
    return result;
  };
  const accessScope = timed("scope", () => getLearningAccessScope(memberId));
  const [paths, activities, meetings, spaces, latestFeedback] =
    await Promise.all([
      timed("learning", () =>
        getPublishedLearningPaths(memberId, undefined, accessScope),
      ),
      timed("activities", () => getPublishedActivities(memberId, accessScope)),
      timed("meetings", () => getMeetings(memberId, accessScope)),
      timed("community", () => getCommunitySpaces()),
      timed("feedback", () =>
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
      ),
    ]);

  console.error(
    `[PERF_HOME] total=${(performance.now() - startedAt).toFixed(1)}ms`,
  );

  return { paths, activities, meetings, spaces, latestFeedback };
};

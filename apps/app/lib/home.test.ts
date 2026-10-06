import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const homeBlockType = {
    NEXT_MEETING: "NEXT_MEETING",
    PREPARATION: "PREPARATION",
    CONTINUE_WATCHING: "CONTINUE_WATCHING",
    PENDING_ACTIVITY: "PENDING_ACTIVITY",
    FEEDBACK: "FEEDBACK",
    ASYNC_LEARNING: "ASYNC_LEARNING",
    COMMUNITY: "COMMUNITY",
    COLLECTION: "COLLECTION",
  };
  return {
    activitySubmissionFindFirst: vi.fn(),
    getHomeBlockConfigurations: vi.fn(),
    getHomeLearningSummary: vi.fn(),
    getLatestCommunityPost: vi.fn(),
    getMemberContinueWatching: vi.fn(),
    getProductConfig: vi.fn(),
    getPublishedActivities: vi.fn(),
    getPublishedCollectionsForMember: vi.fn(),
    getUpcomingMeetings: vi.fn(),
    homeBlockType,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  HomeBlockType: mocks.homeBlockType,
  database: {
    activitySubmission: { findFirst: mocks.activitySubmissionFindFirst },
  },
}));
vi.mock("./activities", () => ({
  getPublishedActivities: mocks.getPublishedActivities,
}));
vi.mock("./community", () => ({
  getLatestCommunityPost: mocks.getLatestCommunityPost,
}));
vi.mock("./content-collections", () => ({
  getPublishedCollectionsForMember: mocks.getPublishedCollectionsForMember,
}));
vi.mock("./home-config", () => ({
  getHomeBlockConfigurations: mocks.getHomeBlockConfigurations,
}));
vi.mock("./learning", () => ({
  getHomeLearningSummary: mocks.getHomeLearningSummary,
}));
vi.mock("./meetings", () => ({
  getUpcomingMeetings: mocks.getUpcomingMeetings,
}));
vi.mock("./product-config", () => ({
  getProductConfig: mocks.getProductConfig,
}));
vi.mock("./recordings", () => ({
  getMemberContinueWatching: mocks.getMemberContinueWatching,
}));

import { getHomeData } from "./home";

const blocks = (enabled: readonly string[] = []) =>
  Object.values(mocks.homeBlockType).map((type) => ({
    collectionId:
      type === "COLLECTION" && enabled.includes(type) ? "collection_1" : null,
    enabled: enabled.includes(type),
    itemCount: 4,
    position: 0,
    subtitle: null,
    title: null,
    type,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getHomeBlockConfigurations.mockResolvedValue(blocks());
  mocks.getProductConfig.mockResolvedValue({
    recordingsExperienceV2: true,
    showLearnNavigation: true,
  });
  mocks.getHomeLearningSummary.mockResolvedValue([]);
  mocks.getPublishedActivities.mockResolvedValue([]);
  mocks.getUpcomingMeetings.mockResolvedValue([]);
  mocks.getLatestCommunityPost.mockResolvedValue(null);
  mocks.getMemberContinueWatching.mockResolvedValue({ continueWatching: [] });
  mocks.getPublishedCollectionsForMember.mockResolvedValue([]);
  mocks.activitySubmissionFindFirst.mockResolvedValue(null);
});

test("skips data queries for disabled home blocks", async () => {
  await getHomeData("member_1");

  expect(mocks.getHomeLearningSummary).not.toHaveBeenCalled();
  expect(mocks.getPublishedActivities).not.toHaveBeenCalled();
  expect(mocks.getUpcomingMeetings).not.toHaveBeenCalled();
  expect(mocks.getLatestCommunityPost).not.toHaveBeenCalled();
  expect(mocks.getMemberContinueWatching).not.toHaveBeenCalled();
  expect(mocks.activitySubmissionFindFirst).not.toHaveBeenCalled();
  expect(mocks.getPublishedCollectionsForMember).not.toHaveBeenCalled();
});

test("loads only enabled blocks and their required data", async () => {
  mocks.getHomeBlockConfigurations.mockResolvedValue(
    blocks(["ASYNC_LEARNING", "PREPARATION"])
  );

  const data = await getHomeData("member_1");

  expect(mocks.getHomeLearningSummary).toHaveBeenCalledWith("member_1");
  expect(mocks.getUpcomingMeetings).toHaveBeenCalledWith("member_1");
  expect(mocks.getPublishedActivities).not.toHaveBeenCalled();
  expect(mocks.getLatestCommunityPost).not.toHaveBeenCalled();
  expect(data.productConfig.showLearnNavigation).toBe(false);
});

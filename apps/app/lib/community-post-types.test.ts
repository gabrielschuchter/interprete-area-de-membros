import { describe, expect, test } from "vitest";
import {
  COMMUNITY_POST_KIND_OPTIONS,
  communityPostKindHasSubtitle,
  communityPostKindLabel,
} from "./community-post-types";

describe("community post types", () => {
  test("keeps the editorial taxonomy explicit", () => {
    expect(COMMUNITY_POST_KIND_OPTIONS.map(({ value }) => value)).toEqual([
      "PUBLICATION",
      "DISCUSSION",
      "QUESTION",
      "CASE",
      "ARTICLE",
      "RESOURCE",
    ]);
    expect(communityPostKindLabel("CASE")).toBe("Caso");
  });

  test("only long-form types expose an optional subtitle", () => {
    expect(communityPostKindHasSubtitle("DISCUSSION")).toBe(false);
    expect(communityPostKindHasSubtitle("QUESTION")).toBe(false);
    expect(communityPostKindHasSubtitle("ARTICLE")).toBe(true);
  });
});

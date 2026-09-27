import { describe, expect, test } from "vitest";
import {
  communityHref,
  parseCommunityKind,
  parseCommunitySort,
} from "./community-query";

describe("community query state", () => {
  test("normalizes unsupported sort and kind values", () => {
    expect(parseCommunitySort("inventado")).toBe("recent");
    expect(parseCommunityKind("inventado")).toBeUndefined();
    expect(parseCommunityKind("QUESTION")).toBe("QUESTION");
  });

  test("keeps combined discovery filters in a stable URL", () => {
    expect(
      communityHref({
        kind: "QUESTION",
        page: 3,
        query: "  método clínico  ",
        sort: "unanswered",
        spaceSlug: "pratica-clinica",
      })
    ).toBe(
      "/comunidade?q=m%C3%A9todo+cl%C3%ADnico&sort=unanswered&kind=QUESTION&space=pratica-clinica&page=3"
    );
  });

  test("omits the default state for a clean explore URL", () => {
    expect(communityHref()).toBe("/comunidade");
    expect(communityHref({ sort: "recent", page: 1 })).toBe("/comunidade");
  });
});

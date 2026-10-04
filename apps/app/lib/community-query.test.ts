import { describe, expect, test } from "vitest";
import { communityHref, parseCommunitySort } from "./community-query";

describe("community query state", () => {
  test("normalizes unsupported sort values", () => {
    expect(parseCommunitySort("inventado")).toBe("recent");
  });

  test("keeps supported discovery state in a stable URL", () => {
    expect(
      communityHref({
        page: 3,
        query: "  método clínico  ",
        sort: "unanswered",
        spaceSlug: "pratica-clinica",
      })
    ).toBe(
      "/comunidade?q=m%C3%A9todo+cl%C3%ADnico&sort=unanswered&space=pratica-clinica&page=3"
    );
  });

  test("omits the default state for a clean explore URL", () => {
    expect(communityHref()).toBe("/comunidade");
    expect(communityHref({ sort: "recent", page: 1 })).toBe("/comunidade");
  });
});

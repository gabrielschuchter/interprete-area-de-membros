import { describe, expect, test } from "vitest";
import {
  communityHref,
  communityReturnLabel,
  communitySavedHref,
  parseCommunityKind,
  parseCommunityReturnTo,
  parseCommunitySort,
} from "./community-query";

describe("community query state", () => {
  test("normalizes unsupported sort values", () => {
    expect(parseCommunitySort("inventado")).toBe("recent");
  });

  test("accepts only persisted community post kinds", () => {
    expect(parseCommunityKind("QUESTION")).toBe("QUESTION");
    expect(parseCommunityKind("inventado")).toBeUndefined();
  });

  test("keeps supported discovery state in a stable URL", () => {
    expect(
      communityHref({
        page: 3,
        kind: "QUESTION",
        query: "  método clínico  ",
        sort: "unanswered",
        spaceSlug: "pratica-clinica",
      })
    ).toBe(
      "/comunidade?q=m%C3%A9todo+cl%C3%ADnico&tipo=QUESTION&sort=unanswered&space=pratica-clinica&page=3"
    );
  });

  test("omits the default state for a clean explore URL", () => {
    expect(communityHref()).toBe("/comunidade");
    expect(communityHref({ sort: "recent", page: 1 })).toBe("/comunidade");
  });

  test("preserves saved community filters and cursor in a stable URL", () => {
    expect(
      communitySavedHref({
        cursor: "cursor_1",
        kind: "QUESTION",
        query: "  método clínico  ",
        sort: "popular",
        spaceSlug: "pratica-clinica",
      })
    ).toBe(
      "/comunidade/salvos?q=m%C3%A9todo+cl%C3%ADnico&space=pratica-clinica&tipo=QUESTION&sort=popular&cursor=cursor_1"
    );
    expect(communitySavedHref()).toBe("/comunidade/salvos");
  });

  test("allows only internal return locations and labels their destination", () => {
    expect(parseCommunityReturnTo("/comunidade/salvos?tipo=QUESTION")).toBe(
      "/comunidade/salvos?tipo=QUESTION"
    );
    expect(parseCommunityReturnTo("//example.com/path")).toBeUndefined();
    expect(parseCommunityReturnTo("https://example.com/path")).toBeUndefined();
    expect(
      communityReturnLabel("/comunidade/grupos/pratica-clinica?cursor=abc")
    ).toBe("Grupos de estudo");
    expect(communityReturnLabel("/salvos?tipo=comunidade")).toBe("Salvos");
  });
});

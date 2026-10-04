import { describe, expect, it } from "vitest";
import {
  communityPostAudienceWhere,
  communityPostMutationAudienceWhere,
  communitySpaceAudienceWhere,
  communitySpaceMemberAudienceWhere,
  communitySpaceSlugBase,
  normalizeCommunitySpaceTitle,
} from "./community-space-rules";

describe("community space rules", () => {
  it("normalizes duplicate names without losing readable titles", () => {
    expect(normalizeCommunitySpaceTitle("  Clínica   Pediátrica ")).toBe(
      "clinica pediatrica"
    );
    expect(communitySpaceSlugBase("Clínica Pediátrica")).toBe(
      "clinica-pediatrica"
    );
    expect(normalizeCommunitySpaceTitle("学习 小组")).toBe("学习 小组");
  });

  it("limits unauthenticated readers to public spaces", () => {
    expect(communitySpaceAudienceWhere(null)).toEqual({ visibility: "PUBLIC" });
  });

  it("includes public spaces, owners, and members for a member", () => {
    expect(communitySpaceAudienceWhere("member-1")).toEqual({
      OR: [
        { visibility: "PUBLIC" },
        { ownerId: "member-1" },
        { members: { some: { memberId: "member-1" } } },
      ],
    });
  });

  it("lets moderators resolve all groups and scopes feed posts by audience", () => {
    expect(communitySpaceAudienceWhere("teacher-1", true)).toEqual({});
    expect(communityPostAudienceWhere("member-1")).toEqual({
      OR: [
        { spaceId: null },
        {
          space: {
            is: {
              status: "PUBLISHED",
              OR: [
                { visibility: "PUBLIC" },
                { ownerId: "member-1" },
                { members: { some: { memberId: "member-1" } } },
              ],
            },
          },
        },
      ],
    });
  });

  it("requires membership for group mutations even when a group is public", () => {
    expect(communitySpaceMemberAudienceWhere("member-1")).toEqual({
      OR: [
        { ownerId: "member-1" },
        { members: { some: { memberId: "member-1" } } },
      ],
    });
    expect(communitySpaceMemberAudienceWhere("teacher-1", true)).toEqual({});
    expect(communityPostMutationAudienceWhere("member-1")).toEqual({
      OR: [
        { spaceId: null },
        {
          space: {
            is: {
              status: "PUBLISHED",
              OR: [
                { ownerId: "member-1" },
                { members: { some: { memberId: "member-1" } } },
              ],
            },
          },
        },
      ],
    });
  });
});

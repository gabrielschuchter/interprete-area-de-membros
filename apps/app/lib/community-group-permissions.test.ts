import { describe, expect, test } from "vitest";
import {
  canArchiveStudyGroup,
  canChangeStudyGroupMemberRole,
  canChangeStudyGroupPrivacy,
  canEditStudyGroup,
  canManageStudyGroupParticipants,
  canReadPrivateStudyGroup,
  canRemoveStudyGroupMember,
} from "./community-group-permissions";

describe("community group permissions", () => {
  test("members can read public groups but do not manage them", () => {
    expect(
      canEditStudyGroup({ isOwner: false, isModerator: false, isStaff: false })
    ).toBe(false);
    expect(canManageStudyGroupParticipants(false)).toBe(false);
    expect(canChangeStudyGroupPrivacy(false)).toBe(false);
    expect(canArchiveStudyGroup(false)).toBe(false);
  });

  test("moderators edit approved group fields without participant or sensitive controls", () => {
    expect(
      canEditStudyGroup({ isOwner: false, isModerator: true, isStaff: false })
    ).toBe(true);
    expect(canManageStudyGroupParticipants(false)).toBe(false);
    expect(canChangeStudyGroupPrivacy(false)).toBe(false);
    expect(canArchiveStudyGroup(false)).toBe(false);
    expect(
      canChangeStudyGroupMemberRole({
        isOwner: false,
        targetGroupRole: "MEMBER",
        targetIdentityRole: "MEMBER",
        nextGroupRole: "MODERATOR",
      })
    ).toBe(false);
    expect(
      canRemoveStudyGroupMember({ isOwner: false, targetGroupRole: "MEMBER" })
    ).toBe(false);
  });

  test("owners can assign member and moderator roles but cannot rewrite ownership or staff roles", () => {
    expect(
      canChangeStudyGroupMemberRole({
        isOwner: true,
        targetGroupRole: "MEMBER",
        targetIdentityRole: "MEMBER",
        nextGroupRole: "MODERATOR",
      })
    ).toBe(true);
    expect(
      canChangeStudyGroupMemberRole({
        isOwner: true,
        targetGroupRole: "MODERATOR",
        targetIdentityRole: "MEMBER",
        nextGroupRole: "MEMBER",
      })
    ).toBe(true);
    expect(
      canChangeStudyGroupMemberRole({
        isOwner: true,
        targetGroupRole: "OWNER",
        targetIdentityRole: "MEMBER",
        nextGroupRole: "MEMBER",
      })
    ).toBe(false);
    expect(
      canChangeStudyGroupMemberRole({
        isOwner: true,
        targetGroupRole: "MEMBER",
        targetIdentityRole: "ADMIN",
        nextGroupRole: "MODERATOR",
      })
    ).toBe(false);
    expect(
      canChangeStudyGroupMemberRole({
        isOwner: true,
        targetGroupRole: "MEMBER",
        targetIdentityRole: "MEMBER",
        nextGroupRole: "OWNER",
      })
    ).toBe(false);
  });

  test("staff can read private groups while private access stays explicit", () => {
    expect(
      canReadPrivateStudyGroup({
        isOwner: false,
        isMember: false,
        isStaff: true,
      })
    ).toBe(true);
    expect(
      canReadPrivateStudyGroup({
        isOwner: false,
        isMember: false,
        isStaff: false,
      })
    ).toBe(false);
  });
});

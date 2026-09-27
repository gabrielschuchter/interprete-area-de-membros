import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER" },
  database: {},
}));
vi.mock("./authorization", () => ({ getMemberRole: vi.fn() }));

import { canReadRecordingGroup } from "./recordings";

describe("imported recording authorization", () => {
  test("an unlinked group is not readable by a member", () => {
    expect(
      canReadRecordingGroup(null, { fullAccess: false, memberId: "member-a" })
    ).toBe(false);
  });

  test("a linked group is readable only by its linked member", () => {
    expect(
      canReadRecordingGroup("member-a", {
        fullAccess: false,
        memberId: "member-a",
      })
    ).toBe(true);
    expect(
      canReadRecordingGroup("member-a", {
        fullAccess: false,
        memberId: "member-b",
      })
    ).toBe(false);
  });

  test("staff can inspect the archive without changing member ownership", () => {
    expect(
      canReadRecordingGroup(null, { fullAccess: true, memberId: "admin" })
    ).toBe(true);
  });

  test("revoking a group removes member access immediately", () => {
    expect(
      canReadRecordingGroup(null, {
        fullAccess: false,
        memberId: "member-a",
      })
    ).toBe(false);
  });
});

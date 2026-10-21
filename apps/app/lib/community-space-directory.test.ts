import { describe, expect, test } from "vitest";
import { communitySpaceDirectoryWhere } from "./community-space-directory";

describe("communitySpaceDirectoryWhere", () => {
  test("limits my groups to groups I own or belong to", () => {
    expect(
      communitySpaceDirectoryWhere({
        canModeratePrivateGroups: false,
        memberId: "member-a",
        section: "mine",
      })
    ).toEqual({
      AND: [
        {
          OR: [
            { visibility: "PUBLIC" },
            { ownerId: "member-a" },
            { members: { some: { memberId: "member-a" } } },
          ],
        },
        {
          OR: [
            {
              status: "PUBLISHED",
              OR: [
                { ownerId: "member-a" },
                { members: { some: { memberId: "member-a" } } },
              ],
            },
            { status: "ARCHIVED", ownerId: "member-a" },
          ],
        },
      ],
    });
  });

  test("shows only public groups the member has not joined in discovery", () => {
    const where = communitySpaceDirectoryWhere({
      canModeratePrivateGroups: false,
      memberId: "member-a",
      section: "discover",
    });

    expect(where).toEqual({
      AND: [
        {
          OR: [
            { visibility: "PUBLIC" },
            { ownerId: "member-a" },
            { members: { some: { memberId: "member-a" } } },
          ],
        },
        {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          NOT: {
            OR: [
              { ownerId: "member-a" },
              { members: { some: { memberId: "member-a" } } },
            ],
          },
        },
      ],
    });
  });

  test("applies a bounded case-insensitive search in the database", () => {
    const where = communitySpaceDirectoryWhere({
      canModeratePrivateGroups: false,
      memberId: "member-a",
      query: `  ${"a".repeat(120)}  `,
      section: "discover",
    });
    const conditions = Array.isArray(where.AND) ? where.AND : [];
    const search = conditions[2];
    const expectedQuery = "a".repeat(100);

    expect(search).toEqual({
      OR: [
        { title: { contains: expectedQuery, mode: "insensitive" } },
        { description: { contains: expectedQuery, mode: "insensitive" } },
      ],
    });
  });
});

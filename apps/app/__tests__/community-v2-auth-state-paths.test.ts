import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCommunityQaAuthPaths } from "../e2e/community-v2/auth-state-paths";

describe("Community V2 Clerk storageState paths", () => {
  it("shares the member and admin files under the protected auth directory", () => {
    const authDirectory = resolve(tmpdir(), "community-v2-protected-auth");
    const paths = resolveCommunityQaAuthPaths({
      COMMUNITY_QA_AUTH_DIR: authDirectory,
    });

    expect(paths.authDirectory).toBe(authDirectory);
    expect(paths.memberStatePath).toBe(
      resolve(authDirectory, "community-v2-member.json")
    );
    expect(paths.adminStatePath).toBe(
      resolve(authDirectory, "community-v2-admin.json")
    );
  });
});

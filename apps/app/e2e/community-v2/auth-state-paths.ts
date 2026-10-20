import { tmpdir } from "node:os";
import { resolve } from "node:path";

type AuthPathEnvironment = Readonly<Record<string, string | undefined>>;

export const resolveCommunityQaAuthPaths = (
  environment: AuthPathEnvironment
) => {
  const authDirectory =
    environment.COMMUNITY_QA_AUTH_DIR ??
    resolve(
      environment.LOCALAPPDATA ?? environment.TEMP ?? tmpdir(),
      "Codex/qa/community-v2-foundation-20261015/playwright"
    );

  return {
    adminStatePath: resolve(authDirectory, "community-v2-admin.json"),
    authDirectory,
    memberStatePath: resolve(authDirectory, "community-v2-member.json"),
  };
};

export const { adminStatePath, authDirectory, memberStatePath } =
  resolveCommunityQaAuthPaths(process.env);

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
  const runDirectory = environment.COMMUNITY_QA_OUTPUT_DIR ?? authDirectory;

  return {
    adminStatePath: resolve(authDirectory, "community-v2-admin.json"),
    authDirectory,
    memberStatePath: resolve(authDirectory, "community-v2-member.json"),
    secondaryMemberStatePath: resolve(
      runDirectory,
      "community-v2-member-secondary.json"
    ),
    teacherStatePath: resolve(runDirectory, "community-v2-teacher.json"),
  };
};

export const {
  adminStatePath,
  authDirectory,
  memberStatePath,
  secondaryMemberStatePath,
  teacherStatePath,
} = resolveCommunityQaAuthPaths(process.env);

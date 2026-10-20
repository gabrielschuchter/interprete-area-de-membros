import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { clerkSetup } from "@clerk/testing/playwright";

export default async function globalSetup() {
  process.loadEnvFile(".env.local");
  const authDirectory =
    process.env.COMMUNITY_QA_AUTH_DIR ??
    resolve(
      process.env.LOCALAPPDATA ?? process.env.TEMP ?? ".",
      "Codex/qa/community-v2-foundation-20261015/playwright"
    );
  const authStates = [
    resolve(authDirectory, "community-v2-member.json"),
    resolve(authDirectory, "community-v2-admin.json"),
  ];
  await Promise.all(
    authStates.map(async (path) => {
      await mkdir(dirname(path), { recursive: true });
      try {
        await access(path);
      } catch {
        await writeFile(path, JSON.stringify({ cookies: [], origins: [] }), {
          encoding: "utf8",
        });
      }
    })
  );
  try {
    await clerkSetup();
  } catch (error) {
    const apiError = error as {
      readonly errors?: readonly { readonly code?: string }[];
      readonly status?: number;
    };
    process.stderr.write(
      `Clerk Testing setup failed (HTTP ${apiError.status ?? "unknown"}; codes: ${(apiError.errors ?? []).map(({ code }) => code ?? "unknown").join(",") || "none"}).\n`
    );
    throw error;
  }
}

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { adminStatePath, memberStatePath } from "./auth-state-paths";

export default async function globalSetup() {
  process.loadEnvFile(".env.local");
  const authStates = [memberStatePath, adminStatePath];
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
}

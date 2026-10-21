import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { clerkSetup } from "@clerk/testing/playwright";
import {
  adminStatePath,
  memberStatePath,
  secondaryMemberStatePath,
  teacherStatePath,
} from "./auth-state-paths";

export default async function globalSetup() {
  process.loadEnvFile(".env.local");
  await clerkSetup();
  const authStates = [
    memberStatePath,
    secondaryMemberStatePath,
    teacherStatePath,
    adminStatePath,
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
}

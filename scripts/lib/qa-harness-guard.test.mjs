import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const RETIRED_HARNESSES = [
  {
    file: "scripts/migration/qa-green-new-features.mjs",
    expectedMessage:
      /Retired: this legacy harness writes fixtures to the production GREEN database/,
  },
  {
    file: "scripts/migration/verify-green-new-feature-gaps.mjs",
    expectedMessage:
      /Retired: this verifier writes study intervals to Production GREEN using a Clerk Development identity/,
  },
];
const EXISTING_RETIRED_HARNESSES = RETIRED_HARNESSES.filter(({ file }) =>
  existsSync(path.join(root, file))
);
test("retired GREEN QA harnesses exit before loading database or browser clients", {
  skip:
    EXISTING_RETIRED_HARNESSES.length === 0
      ? "Retired worktree-local QA scripts are not part of this checkout."
      : false,
}, () => {
  const environment = Object.fromEntries(
    ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR"]
      .map((name) => [name, process.env[name]])
      .filter(([, value]) => typeof value === "string")
  );

  for (const { file, expectedMessage } of EXISTING_RETIRED_HARNESSES) {
    const result = spawnSync(process.execPath, [path.join(root, file)], {
      cwd: root,
      encoding: "utf8",
      env: environment,
    });

    assert.equal(result.error, undefined, file);
    assert.equal(result.status, 2, `${file}: ${result.stderr}`);
    assert.equal(result.stdout, "", file);
    assert.match(result.stderr, expectedMessage, file);
  }
});

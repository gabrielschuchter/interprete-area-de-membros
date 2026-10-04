import { describe, expect, test } from "vitest";
import {
  getNextRuntimeConfiguration,
  supportsSystemCa,
} from "../scripts/run-next-with-system-ca.mjs";

describe("local Next.js runtime trust configuration", () => {
  test.each([
    ["22.18.0", "win32", false],
    ["22.19.0", "win32", true],
    ["23.8.0", "win32", true],
    ["23.8.0", "linux", false],
    ["23.9.0", "linux", true],
    ["24.5.0", "win32", false],
    ["24.6.0", "win32", true],
    ["25.0.0", "linux", true],
  ])("supports Node %s on %s: %s", (version, platform, expected) => {
    expect(supportsSystemCa(version, platform as NodeJS.Platform)).toBe(
      expected
    );
  });

  test("starts the official Next CLI with system trust enabled and TLS verification intact", () => {
    const configuration = getNextRuntimeConfiguration({
      args: ["dev", "-p", "3000"],
      cwd: "C:/workspace/apps/app",
      env: { EXISTING_SETTING: "kept" },
      nodeVersion: "24.18.0",
      platform: "win32",
    });

    expect(configuration.args[0]).toBe("--use-system-ca");
    expect(configuration.args[1]).toBe(
      "C:\\workspace\\apps\\app\\node_modules\\next\\dist\\bin\\next"
    );
    expect(configuration.args.slice(2)).toEqual(["dev", "-p", "3000"]);
    expect(configuration.env).toEqual({
      EXISTING_SETTING: "kept",
      NODE_USE_SYSTEM_CA: "1",
    });
  });

  test("fails clearly instead of starting without the required system trust store", () => {
    expect(() =>
      getNextRuntimeConfiguration({
        args: ["dev"],
        cwd: "/workspace/apps/app",
        env: {},
        nodeVersion: "20.15.0",
        platform: "linux",
      })
    ).toThrow("Node.js 22.19+, 24.6+");
  });
});

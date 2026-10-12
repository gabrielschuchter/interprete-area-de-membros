import { describe, expect, it } from "vitest";
import { resolveDevelopmentAuthUserId } from "./development-auth-config";

describe("resolveDevelopmentAuthUserId", () => {
  it("keeps Clerk as the identity provider unless local QA auth is explicit", () => {
    expect(
      resolveDevelopmentAuthUserId({
        enabled: undefined,
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toBeNull();
    expect(
      resolveDevelopmentAuthUserId({
        enabled: "false",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toBeNull();
  });

  it("accepts only an explicitly selected seeded member in development", () => {
    expect(
      resolveDevelopmentAuthUserId({
        enabled: "true",
        nodeEnv: "development",
        userId: "  user_qa_teacher  ",
      })
    ).toBe("user_qa_teacher");
  });

  it("fails closed when enabled outside development or without an actor", () => {
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "true",
        nodeEnv: "production",
        userId: "user_qa_teacher",
      })
    ).toThrow("only in the local development runtime");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "true",
        nodeEnv: "development",
        userId: " ",
      })
    ).toThrow("USER_ID is required");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "yes",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toThrow("must be either true or false");
  });
});

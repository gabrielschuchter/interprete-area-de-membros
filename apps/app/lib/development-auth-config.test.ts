import { describe, expect, it } from "vitest";
import { resolveDevelopmentAuthUserId } from "./development-auth-config";

describe("resolveDevelopmentAuthUserId", () => {
  it("keeps Clerk as the identity provider unless local QA auth is explicit", () => {
    expect(
      resolveDevelopmentAuthUserId({
        enabled: undefined,
        publicEnabled: undefined,
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toBeNull();
    expect(
      resolveDevelopmentAuthUserId({
        enabled: "false",
        publicEnabled: "false",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toBeNull();
  });

  it("accepts only an explicitly selected seeded member in development", () => {
    expect(
      resolveDevelopmentAuthUserId({
        enabled: "true",
        publicEnabled: "true",
        nodeEnv: "development",
        userId: "  user_qa_teacher  ",
      })
    ).toBe("user_qa_teacher");
  });

  it("fails closed when enabled outside development or without an actor", () => {
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "true",
        publicEnabled: "true",
        nodeEnv: "production",
        userId: "user_qa_teacher",
      })
    ).toThrow("only in the local development runtime");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "true",
        publicEnabled: "true",
        nodeEnv: "development",
        userId: " ",
      })
    ).toThrow("USER_ID is required");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "yes",
        publicEnabled: "true",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toThrow("must be either true or false");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "true",
        publicEnabled: "false",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toThrow("must be enabled together");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "false",
        publicEnabled: "true",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toThrow("must be enabled together");
    expect(() =>
      resolveDevelopmentAuthUserId({
        enabled: "false",
        publicEnabled: "perhaps",
        nodeEnv: "development",
        userId: "user_qa_teacher",
      })
    ).toThrow("NEXT_PUBLIC_GESTAO_DEV_AUTH must be either true or false");
  });
});

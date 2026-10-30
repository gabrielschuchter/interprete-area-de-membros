import { getClerkEnvironmentConfigurationError } from "@repo/auth/clerk-environment";
import { expect, test } from "vitest";

test("rejects Clerk production credentials in local development", () => {
  expect(
    getClerkEnvironmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_live_redacted",
      secretKey: "sk_live_redacted",
    })
  ).toContain("chaves Production não são aceitas");
});

test("rejects publishable and secret keys from different Clerk environments", () => {
  expect(
    getClerkEnvironmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_live_redacted",
    })
  ).toContain("prefixos de ambiente");
});

test("rejects publishable and secret keys from different environments everywhere", () => {
  expect(
    getClerkEnvironmentConfigurationError({
      nodeEnv: "production",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_live_redacted",
    })
  ).toContain("prefixos de ambiente");
});

test("keeps local Development keys paired with the Development instance", () => {
  expect(
    getClerkEnvironmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_test_redacted",
    })
  ).toBeUndefined();
});

test("rejects obsolete Frontend API proxy variables in every environment", () => {
  expect(
    getClerkEnvironmentConfigurationError({
      nodeEnv: "production",
      publishableKey: "pk_live_redacted",
      secretKey: "sk_live_redacted",
      proxyVariables: ["NEXT_PUBLIC_CLERK_PROXY_URL"],
    })
  ).toContain("NEXT_PUBLIC_CLERK_PROXY_URL");
});

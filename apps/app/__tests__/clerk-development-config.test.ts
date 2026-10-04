import { getClerkDevelopmentConfigurationError } from "@repo/auth/clerk-proxy";
import { expect, test } from "vitest";

test("rejects Clerk production credentials in local development", () => {
  expect(
    getClerkDevelopmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_live_redacted",
      secretKey: "sk_live_redacted",
    })
  ).toContain("chaves Production não são aceitas");
});

test("rejects publishable and secret keys from different Clerk environments", () => {
  expect(
    getClerkDevelopmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_live_redacted",
    })
  ).toContain("prefixos de ambiente");
});

test("rejects publishable and secret keys from different environments everywhere", () => {
  expect(
    getClerkDevelopmentConfigurationError({
      nodeEnv: "production",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_live_redacted",
    })
  ).toContain("prefixos de ambiente");
});

test("keeps the local Development instance on its direct Frontend API", () => {
  expect(
    getClerkDevelopmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_test_redacted",
      proxyUrl: "https://production.example/__clerk",
    })
  ).toContain("diretamente");

  expect(
    getClerkDevelopmentConfigurationError({
      nodeEnv: "development",
      publishableKey: "pk_test_redacted",
      secretKey: "sk_test_redacted",
    })
  ).toBeUndefined();
});

test("does not change production Clerk proxy configuration", () => {
  expect(
    getClerkDevelopmentConfigurationError({
      nodeEnv: "production",
      publishableKey: "pk_live_redacted",
      secretKey: "sk_live_redacted",
      proxyUrl: "https://members.example/__clerk",
    })
  ).toBeUndefined();
});

import { expect, test } from "vitest";
import { isAuthorizedCronRequest } from "../lib/cron-auth";

const requestWithAuthorization = (authorization?: string) =>
  new Request("https://api.example.test/cron/outbox", {
    headers: authorization ? { authorization } : undefined,
  });

const cronSecret = "cron-secret-with-at-least-32-characters-long";

test("protects scheduled endpoints with an exact bearer secret", () => {
  expect(
    isAuthorizedCronRequest(
      requestWithAuthorization(`Bearer ${cronSecret}`),
      cronSecret
    )
  ).toBe(true);
  expect(
    isAuthorizedCronRequest(
      requestWithAuthorization(`Bearer ${"x".repeat(cronSecret.length)}`),
      cronSecret
    )
  ).toBe(false);
  expect(isAuthorizedCronRequest(requestWithAuthorization(), cronSecret)).toBe(
    false
  );
  expect(
    isAuthorizedCronRequest(
      requestWithAuthorization(`Bearer ${cronSecret}`),
      undefined
    )
  ).toBe(false);
  expect(
    isAuthorizedCronRequest(
      requestWithAuthorization("Bearer cron-secret"),
      "cron-secret"
    )
  ).toBe(false);
});

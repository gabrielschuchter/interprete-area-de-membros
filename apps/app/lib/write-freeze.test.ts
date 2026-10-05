import {
  createUploadsPausedResponse,
  createWriteFreezeResponse,
  isAppWriteFreezeEnabled,
  isClerkFrontendApiProxyPath,
  shouldBlockRequestDuringWriteFreeze,
  shouldPauseStorageUploadDuringRollback,
  shouldPauseUploadDuringRollback,
} from "@repo/security/write-freeze";
import { describe, expect, it } from "vitest";

describe("write freeze", () => {
  it("recognizes the centralized flag value without accepting ambiguous values", () => {
    expect(isAppWriteFreezeEnabled("true")).toBe(true);
    expect(isAppWriteFreezeEnabled("false")).toBe(false);
    expect(isAppWriteFreezeEnabled(undefined)).toBe(false);
    expect(isAppWriteFreezeEnabled("1")).toBe(false);
  });

  it("leaves ordinary reads and the Clerk Frontend API proxy available", () => {
    expect(
      shouldBlockRequestDuringWriteFreeze({
        method: "GET",
        pathname: "/comunidade",
        enabled: true,
      })
    ).toBe(false);
    expect(
      shouldBlockRequestDuringWriteFreeze({
        method: "POST",
        pathname: "/__clerk/v1/client/sign_ins",
        enabled: true,
        clerkFrontendApiProxy: true,
      })
    ).toBe(false);
    expect(isClerkFrontendApiProxyPath("/__clerk/v1/client")).toBe(true);
    expect(isClerkFrontendApiProxyPath("/api/__clerk/v1/client")).toBe(false);
  });

  it("blocks Server Actions and API writes regardless of their page route", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        shouldBlockRequestDuringWriteFreeze({
          method,
          pathname: "/comunidade",
          enabled: true,
        })
      ).toBe(true);
    }
  });

  it("blocks GET and automatic HEAD handlers used by jobs and webhooks", () => {
    for (const pathname of [
      "/api/cron/activity-deadlines",
      "/cron/outbox",
      "/webhooks/auth",
    ]) {
      expect(
        shouldBlockRequestDuringWriteFreeze({
          method: "GET",
          pathname,
          enabled: true,
        })
      ).toBe(true);
      expect(
        shouldBlockRequestDuringWriteFreeze({
          method: "HEAD",
          pathname,
          enabled: true,
        })
      ).toBe(true);
    }

    expect(
      shouldBlockRequestDuringWriteFreeze({
        method: "GET",
        pathname: "/api/learning/recordings/recording-1/thumbnail",
        enabled: true,
      })
    ).toBe(false);
    expect(
      shouldBlockRequestDuringWriteFreeze({
        method: "GET",
        pathname: "/api/health",
        enabled: true,
      })
    ).toBe(false);
  });

  it("does not block reads when disabled and returns a retryable maintenance response when enabled", async () => {
    expect(
      shouldBlockRequestDuringWriteFreeze({
        method: "POST",
        pathname: "/comunidade",
        enabled: false,
      })
    ).toBe(false);

    const response = createWriteFreezeResponse(
      new Request("https://members.example/api/community/posts", {
        method: "POST",
      })
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "WRITE_FREEZE",
      retryable: true,
    });
  });

  it("pauses only new app and recording-thumbnail uploads during rollback", async () => {
    for (const pathname of [
      "/api/member-assets",
      "/api/learning/recordings/recording-1/thumbnail",
    ]) {
      expect(
        shouldPauseUploadDuringRollback({
          method: "POST",
          pathname,
          enabled: true,
        })
      ).toBe(true);
    }
    expect(
      shouldPauseUploadDuringRollback({
        method: "POST",
        pathname: "/api/member-assets",
        enabled: false,
      })
    ).toBe(false);
    expect(
      shouldPauseUploadDuringRollback({
        method: "DELETE",
        pathname: "/api/member-assets",
        enabled: true,
      })
    ).toBe(false);
    expect(
      shouldPauseUploadDuringRollback({
        method: "POST",
        pathname: "/api/community/comments",
        enabled: true,
      })
    ).toBe(false);

    const response = createUploadsPausedResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("3600");
    await expect(response.json()).resolves.toMatchObject({
      code: "UPLOADS_PAUSED",
      retryable: true,
    });
  });

  it("pauses file-backed library actions without blocking URL-only edits", () => {
    expect(
      shouldPauseStorageUploadDuringRollback({
        enabled: true,
        hasFile: true,
      })
    ).toBe(true);
    expect(
      shouldPauseStorageUploadDuringRollback({
        enabled: true,
        hasFile: false,
      })
    ).toBe(false);
    expect(
      shouldPauseStorageUploadDuringRollback({
        enabled: false,
        hasFile: true,
      })
    ).toBe(false);
  });
});

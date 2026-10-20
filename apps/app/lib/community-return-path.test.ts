import { describe, expect, test } from "vitest";
import { safeCommunityReturnPath } from "./community-return-path";

describe("safe community return path", () => {
  test("preserves local community route state", () => {
    expect(
      safeCommunityReturnPath(
        "/comunidade/minhas-publicacoes?status=archived#top"
      )
    ).toBe("/comunidade/minhas-publicacoes?status=archived#top");
  });

  test.each([
    "https://example.com/comunidade",
    "//example.com/comunidade",
    "/admin/community",
    "/comunidade/../admin/community",
    "javascript:alert(1)",
  ])("rejects non-community or external destination %s", (value) => {
    expect(safeCommunityReturnPath(value)).toBeNull();
  });
});

import { containsCommunityPostShareCapability } from "@repo/analytics/privacy";
import { describe, expect, test } from "vitest";

describe("community share URL telemetry filter", () => {
  const token = "a".repeat(43);

  test("detects a share capability inside captured event properties", () => {
    expect(
      containsCommunityPostShareCapability({
        $current_url: `https://example.test/comunidade/compartilhar/${token}`,
      })
    ).toBe(true);
  });

  test("detects a Clerk return URL after query encoding", () => {
    const returnPath = encodeURIComponent(`/comunidade/compartilhar/${token}`);
    expect(
      containsCommunityPostShareCapability({
        properties: { redirect_url: returnPath },
      })
    ).toBe(true);
  });

  test("keeps unrelated event URLs eligible for analytics", () => {
    expect(
      containsCommunityPostShareCapability({
        $current_url: "https://example.test/comunidade/publicacoes/abc123",
      })
    ).toBe(false);
  });
});

import { describe, expect, test } from "vitest";
import {
  collectionCoverPresets,
  isAllowedCollectionCoverUrl,
} from "./collection-covers";

describe("collection cover sources", () => {
  test("allows the bundled editorial covers and HTTPS sources", () => {
    for (const cover of collectionCoverPresets) {
      expect(isAllowedCollectionCoverUrl(cover.value)).toBe(true);
    }
    expect(
      isAllowedCollectionCoverUrl("https://cdn.example.test/cover.jpg")
    ).toBe(true);
    expect(isAllowedCollectionCoverUrl("")).toBe(true);
  });

  test("rejects unknown local paths and non-HTTPS sources", () => {
    expect(isAllowedCollectionCoverUrl("/uploads/unreviewed.svg")).toBe(false);
    expect(
      isAllowedCollectionCoverUrl("http://cdn.example.test/cover.jpg")
    ).toBe(false);
    expect(isAllowedCollectionCoverUrl("javascript:alert(1)")).toBe(false);
  });
});

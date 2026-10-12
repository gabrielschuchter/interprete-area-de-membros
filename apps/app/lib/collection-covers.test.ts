import { describe, expect, test } from "vitest";
import {
  collectionCoverPresets,
  collectionCoverStyle,
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

  test("creates background styles only for allowed collection covers", () => {
    expect(collectionCoverStyle("javascript:alert(1)")).toBeUndefined();
    expect(collectionCoverStyle("/uploads/unreviewed.svg")).toBeUndefined();
    expect(
      collectionCoverStyle(collectionCoverPresets[0]?.value ?? null)
    ).toEqual({
      backgroundImage: 'url("/brand/learning/evidence-screen.png")',
    });
  });

  test("allows only canonical controlled member-asset URLs", () => {
    expect(
      isAllowedCollectionCoverUrl(
        "/api/member-assets?path=community-assets%2Fcovers%2Fmember-1%2Fcover.webp"
      )
    ).toBe(true);
    expect(
      isAllowedCollectionCoverUrl(
        "/api/member-assets?path=library-assets%2Fcover.webp"
      )
    ).toBe(true);
    expect(
      isAllowedCollectionCoverUrl(
        "/api/member-assets?path=community-assets%2Fattachments%2Fx%2Ffile.pdf"
      )
    ).toBe(false);
    expect(
      isAllowedCollectionCoverUrl(
        "/api/member-assets?path=community-assets%2Fcovers%2Fx%2Fcover.webp&variant=thumb"
      )
    ).toBe(false);
    expect(
      isAllowedCollectionCoverUrl(
        "/api/member-assets?path=community-assets%2Fcovers%2F..%2Fsecret.webp"
      )
    ).toBe(false);
  });
});

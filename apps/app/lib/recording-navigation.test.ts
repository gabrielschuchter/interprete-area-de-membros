import { describe, expect, test } from "vitest";
import {
  recordingArchiveHref,
  resolveRecordingPlaybackSelection,
} from "./recording-navigation";

describe("recording archive navigation", () => {
  test("preserves the selected recording and filters when loading another page", () => {
    const href = recordingArchiveHref({
      asset: "asset/áudio 1",
      cursor: "recording-18",
      query: "  epidemiologia  ",
      year: "2026",
    });
    const url = new URL(href, "https://interprete.test");

    expect(url.pathname).toBe("/encontros/gravacoes");
    expect(url.searchParams.get("asset")).toBe("asset/áudio 1");
    expect(url.searchParams.get("cursor")).toBe("recording-18");
    expect(url.searchParams.get("q")).toBe("epidemiologia");
    expect(url.searchParams.get("year")).toBe("2026");
  });

  test("does not add an empty query string", () => {
    expect(recordingArchiveHref({})).toBe("/encontros/gravacoes");
  });

  test("uses the first continuation only when no recording was requested", () => {
    const first = { asset: { id: "asset-1" } };

    expect(resolveRecordingPlaybackSelection(undefined, null, [first])).toBe(
      first
    );
  });

  test("does not show an unrelated recording for an unavailable requested asset", () => {
    const unrelated = { asset: { id: "asset-1" } };

    expect(
      resolveRecordingPlaybackSelection("asset-foreign", null, [unrelated])
    ).toBeNull();
  });

  test("selects the requested recording rather than a different continuation", () => {
    const requested = { asset: { id: "asset-2" } };
    const unrelated = { asset: { id: "asset-1" } };

    expect(
      resolveRecordingPlaybackSelection("asset-2", requested, [unrelated])
    ).toBe(requested);
  });
});

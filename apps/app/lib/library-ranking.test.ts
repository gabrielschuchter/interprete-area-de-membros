import { describe, expect, test } from "vitest";
import { libraryPopularityScore, librarySearchScore } from "./library-ranking";

describe("library relevance signals", () => {
  test("weights real readers and saves above one additional search match", () => {
    expect(
      libraryPopularityScore({
        bookmarks: 4,
        openCount: 17,
        uniqueVisitors: 10,
      })
    ).toBe(83);
    expect(
      librarySearchScore(
        {
          authors: "Ada Silva",
          description: "Revisão clínica",
          tags: ["clínica"],
          title: "Estudo transversal",
        },
        "clínica"
      )
    ).toBe(6);
  });
});

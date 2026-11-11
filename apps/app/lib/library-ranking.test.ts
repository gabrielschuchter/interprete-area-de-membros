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

  test("matches the Portuguese title as well as the original", () => {
    const fields = {
      authors: null,
      description: null,
      tags: [],
      title: "Clinical practice guideline",
      titlePt: "Diretriz de prática clínica",
    };
    expect(librarySearchScore(fields, "diretriz")).toBe(6);
    expect(librarySearchScore(fields, "guideline")).toBe(6);
    expect(librarySearchScore({ ...fields, titlePt: null }, "diretriz")).toBe(
      0
    );
  });
});

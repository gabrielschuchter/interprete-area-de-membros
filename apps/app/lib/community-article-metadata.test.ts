import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enrichCommunityArticleMetadata } from "./community-article-metadata";

describe("community article metadata", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("persists real Crossref metadata for a DOI article", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            author: [
              { family: "Silva", given: "Ana" },
              { family: "Costa", given: "Bruno" },
            ],
            "container-title": ["Journal of Real Data"],
            title: ["A verified article"],
            published: { "date-parts": [[2024, 6, 1]] },
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await enrichCommunityArticleMetadata({
      type: "doc",
      content: [
        {
          type: "communityArticle",
          attrs: {
            doi: "10.5555/verified-article",
            url: "https://doi.org/10.5555/verified-article",
          },
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      content: [
        {
          attrs: {
            authors: "Ana Silva, Bruno Costa",
            doi: "10.5555/verified-article",
            journal: "Journal of Real Data",
            metadataStatus: "available",
            title: "A verified article",
            url: "https://doi.org/10.5555/verified-article",
            year: 2024,
          },
        },
      ],
    });
  });

  test("marks unavailable metadata without inventing article fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await enrichCommunityArticleMetadata({
      type: "doc",
      content: [
        {
          type: "communityArticle",
          attrs: {
            doi: "10.5555/missing-article",
            url: "https://doi.org/10.5555/missing-article",
          },
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      content: [
        {
          attrs: {
            doi: "10.5555/missing-article",
            metadataStatus: "unavailable",
            url: "https://doi.org/10.5555/missing-article",
          },
        },
      ],
    });
    const attrs = (
      result as { content: Array<{ attrs: Record<string, unknown> }> }
    ).content[0].attrs;
    expect(attrs).not.toHaveProperty("authors");
    expect(attrs).not.toHaveProperty("journal");
    expect(attrs).not.toHaveProperty("title");
    expect(attrs).not.toHaveProperty("year");
  });

  test("shares one in-flight request when a page repeats the same DOI", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = enrichCommunityArticleMetadata({
      type: "doc",
      content: [
        {
          type: "communityArticle",
          attrs: { doi: "10.5555/in-flight" },
        },
      ],
    });
    const second = enrichCommunityArticleMetadata({
      type: "doc",
      content: [
        {
          type: "communityArticle",
          attrs: { doi: "10.5555/in-flight" },
        },
      ],
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch?.(
      new Response(
        JSON.stringify({ message: { title: ["Shared metadata"] } }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );
    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { content: [{ attrs: { title: "Shared metadata" } }] },
      { content: [{ attrs: { title: "Shared metadata" } }] },
    ]);
  });

  test("enriches a legacy DOI link mark without changing its link behavior", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            "container-title": ["Evidence Journal"],
            title: ["Linked evidence"],
            published: { "date-parts": [[2023]] },
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await enrichCommunityArticleMetadata({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              marks: [
                {
                  attrs: { href: "https://doi.org/10.5555/legacy-link" },
                  type: "link",
                },
              ],
              text: "Leia o estudo",
              type: "text",
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      content: [
        {
          content: [
            {
              marks: [
                {
                  attrs: {
                    doi: "10.5555/legacy-link",
                    journal: "Evidence Journal",
                    metadataStatus: "available",
                    title: "Linked evidence",
                    year: 2023,
                  },
                  type: "link",
                },
              ],
            },
          ],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

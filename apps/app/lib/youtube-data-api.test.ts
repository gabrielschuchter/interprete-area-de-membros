import { describe, expect, it, vi } from "vitest";
import { createYouTubeDataApiAdapter } from "./youtube-data-api";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });

describe("YouTube Data API adapter", () => {
  it("requests video metadata from the fixed API host and maps the response", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        items: [
          {
            id: "AbC123xYz01",
            snippet: {
              title: "Aula",
              thumbnails: {
                high: { url: "https://i.ytimg.com/vi/AbC123xYz01/hq.jpg" },
              },
            },
            contentDetails: { duration: "PT14M32S", caption: "true" },
            status: { privacyStatus: "unlisted", embeddable: true },
          },
        ],
      })
    );
    const adapter = createYouTubeDataApiAdapter(
      "server-secret",
      fetchImplementation
    );

    await expect(adapter.getVideo("AbC123xYz01")).resolves.toMatchObject({
      videoId: "AbC123xYz01",
      title: "Aula",
      durationSeconds: 872,
      privacyStatus: "UNLISTED",
      embeddable: true,
      captionsAvailable: true,
    });
    const requested = new URL(String(fetchImplementation.mock.calls[0]?.[0]));
    expect(requested.origin).toBe("https://www.googleapis.com");
    expect(requested.pathname).toBe("/youtube/v3/videos");
    expect(requested.searchParams.get("part")).toBe(
      "snippet,contentDetails,status"
    );
    expect(requested.searchParams.get("key")).toBe("server-secret");
  });

  it("preserves playlist order, marks private items non-importable, and follows one page token", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          pageInfo: { totalResults: 3 },
          nextPageToken: "next-token",
          items: [
            {
              snippet: {
                position: 0,
                title: "Primeiro",
                resourceId: { videoId: "AbC123xYz01" },
              },
            },
            {
              snippet: {
                position: 1,
                title: "Privado",
                resourceId: { videoId: "AbC123xYz02" },
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        response({
          items: [
            {
              id: "AbC123xYz01",
              snippet: { title: "Primeiro" },
              contentDetails: { duration: "PT30S", caption: "false" },
              status: { privacyStatus: "unlisted", embeddable: true },
            },
          ],
        })
      );
    const adapter = createYouTubeDataApiAdapter(
      "server-secret",
      fetchImplementation
    );

    const result = await adapter.getPlaylistPage("PLGestaoDevFixture01");
    expect(result.nextPageToken).toBe("next-token");
    expect(result.totalResults).toBe(3);
    expect(result.items.map((item) => item.title)).toEqual([
      "Primeiro",
      "Privado",
    ]);
    expect(result.items[0]?.importable).toBe(true);
    expect(result.items[1]).toMatchObject({
      videoId: "AbC123xYz02",
      importable: false,
      metadata: null,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("does not convert upstream errors into successful empty results", async () => {
    const adapter = createYouTubeDataApiAdapter("server-secret", async () =>
      response({ error: { message: "quota" } }, 403)
    );
    await expect(adapter.getVideo("AbC123xYz01")).rejects.toThrow(
      "YouTube Data API returned 403"
    );
  });
});

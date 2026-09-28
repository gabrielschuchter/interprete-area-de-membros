import { describe, expect, test } from "vitest";
import {
  communityMediaImageUrl,
  directVideoUrl,
  extractCommunityMedia,
  extractDoi,
  formatCommunityFileSize,
  normalizeCommunityCoverUrl,
  safeCommunityMediaUrl,
  videoEmbedFromUrl,
} from "./community-media";

describe("community media", () => {
  test("leaves a text-only publication without media", () => {
    expect(
      extractCommunityMedia({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ text: "Só texto", type: "text" }] },
        ],
      })
    ).toEqual([]);
  });

  test("extracts supported media without making external requests", () => {
    const media = extractCommunityMedia({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            alt: "Figura",
            height: 600,
            src: "https://cdn.example/one.webp",
            width: 900,
          },
        },
        {
          type: "image",
          attrs: { src: "https://cdn.example/two.webp" },
        },
        {
          type: "communityFile",
          attrs: {
            mimeType: "application/pdf",
            name: "referencia.pdf",
            sizeBytes: 2048,
            src: "/api/member-assets?path=community-assets/attachments/member-1/file.pdf",
          },
        },
        {
          type: "communityVideo",
          attrs: {
            provider: "youtube",
            src: "https://www.youtube-nocookie.com/embed/abc1234?rel=0",
          },
        },
        {
          type: "communityArticle",
          attrs: {
            doi: "10.1000/example",
            journal: "Journal of Testing",
            title: "A real stored title",
            url: "https://doi.org/10.1000/example",
            year: 2025,
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [
                {
                  attrs: { href: "https://example.org/material" },
                  type: "link",
                },
              ],
              text: "Material externo",
            },
          ],
        },
      ],
    });

    expect(media.map(({ kind }) => kind)).toEqual([
      "image",
      "image",
      "file",
      "video",
      "article",
      "link",
    ]);
    expect(media[0]).toMatchObject({ height: 600, width: 900 });
    expect(media[2]).toMatchObject({
      kind: "file",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });
    expect(media[4]).toMatchObject({
      doi: "10.1000/example",
      journal: "Journal of Testing",
      title: "A real stored title",
      year: 2025,
    });
    expect(media[5]).toMatchObject({
      domain: "example.org",
      title: "Material externo",
    });
  });

  test("recognizes safe embeds and rejects unsafe asset URLs", () => {
    expect(videoEmbedFromUrl("https://youtu.be/abc1234")).toEqual({
      provider: "youtube",
      src: "https://www.youtube-nocookie.com/embed/abc1234?rel=0",
    });
    expect(videoEmbedFromUrl("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      src: "https://player.vimeo.com/video/123456789",
    });
    expect(directVideoUrl("https://cdn.example/video.webm")).toBe(
      "https://cdn.example/video.webm"
    );
    expect(
      safeCommunityMediaUrl(
        "/api/member-assets?path=community-assets/attachments/member-1/file.pdf"
      )
    ).toContain("community-assets/attachments/");
    expect(
      safeCommunityMediaUrl(
        "/api/member-assets?path=community-assets/attachments/../private.pdf"
      )
    ).toBeNull();
    expect(safeCommunityMediaUrl("javascript:alert(1)")).toBeNull();
    expect(
      communityMediaImageUrl(
        "/api/member-assets?path=community-assets/inline/member-1/image.webp",
        "thumb"
      )
    ).toContain("variant=thumb");
    expect(
      communityMediaImageUrl("https://cdn.example/image.webp", "thumb")
    ).toBe("https://cdn.example/image.webp");
    expect(
      normalizeCommunityCoverUrl(
        "/api/member-assets?path=community-assets/covers/member-1/cover.webp"
      )
    ).toContain("community-assets/covers/");
    expect(
      normalizeCommunityCoverUrl(
        "/api/member-assets?path=community-assets/inline/member-1/body.webp"
      )
    ).toBeNull();
  });

  test("normalizes DOI and file size labels", () => {
    expect(extractDoi("https://doi.org/10.5555/example.")).toBe(
      "10.5555/example"
    );
    expect(formatCommunityFileSize(1024)).toBe("1 KB");
    expect(formatCommunityFileSize(1_048_576)).toBe("1 MB");
    expect(formatCommunityFileSize(undefined)).toBeNull();
  });
});

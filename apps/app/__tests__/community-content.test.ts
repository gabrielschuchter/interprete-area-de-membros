import { describe, expect, test } from "vitest";
import {
  plainTextFromDocument,
  sanitizeRichDocument,
} from "../lib/community-content";

describe("community rich content", () => {
  test("keeps supported formatting and removes unsafe links", () => {
    const document = sanitizeRichDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Leia a " },
            {
              type: "text",
              text: "referência",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
            {
              type: "text",
              text: " perigosa",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });

    expect(document).not.toBeNull();
    expect(JSON.stringify(document)).toContain("https://example.com");
    expect(JSON.stringify(document)).not.toContain("javascript:");
    expect(plainTextFromDocument(document)).toBe("Leia a referência perigosa");
  });

  test("rejects a non-document root", () => {
    expect(sanitizeRichDocument({ type: "paragraph", content: [] })).toBeNull();
  });

  test("allows safe images and removes unsafe image sources", () => {
    const document = sanitizeRichDocument({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://cdn.example.com/figure.png",
            alt: "Figura de estudo",
          },
        },
        {
          type: "image",
          attrs: { src: "javascript:alert(1)" },
        },
      ],
    });

    expect(document).not.toBeNull();
    expect(JSON.stringify(document)).toContain("cdn.example.com/figure.png");
    expect(JSON.stringify(document)).not.toContain("javascript:");
  });
});

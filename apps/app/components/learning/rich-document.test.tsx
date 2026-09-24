import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { RichDocument } from "./rich-document";

test("renders structured lesson content without trusting unsafe links", () => {
  const { container } = render(
    <RichDocument
      value={{
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Comece pela pergunta" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Leia " },
              {
                type: "text",
                text: "a referência",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://example.com/reference" },
                  },
                ],
              },
              { type: "text", text: " antes de decidir." },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Link não confiável",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      }}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Comece pela pergunta" })
  ).toBeDefined();
  expect(
    screen.getByRole("link", { name: "a referência" }).getAttribute("href")
  ).toBe("https://example.com/reference");
  expect(screen.getByText("Link não confiável")).toBeDefined();
  expect(container.querySelectorAll("a")).toHaveLength(1);
  expect(container.innerHTML).not.toContain("javascript:");
});

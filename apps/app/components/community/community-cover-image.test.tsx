import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { CommunityCoverImage } from "./community-cover-image";

const properties = {
  alt: "Capa: uma pergunta clínica",
  className: "community-post-card__media",
  height: 100,
  src: "https://assets.example/cover.webp",
  width: 148,
};

describe("CommunityCoverImage", () => {
  afterEach(() => cleanup());

  test("shows a neutral thumbnail when the stored cover cannot load", () => {
    render(<CommunityCoverImage {...properties} />);

    fireEvent.error(screen.getByRole("img", { name: properties.alt }));

    const fallback = screen.getByRole("img", {
      name: properties.alt,
    });
    expect(fallback.tagName).toBe("SPAN");
    expect(fallback.classList.contains("community-cover-fallback")).toBe(true);
    expect(fallback.querySelector("svg")).toBeTruthy();
  });

  test("retries when the cover URL changes", () => {
    const { rerender } = render(<CommunityCoverImage {...properties} />);

    fireEvent.error(screen.getByRole("img", { name: properties.alt }));
    rerender(
      <CommunityCoverImage
        {...properties}
        src="https://assets.example/next.webp"
      />
    );

    expect(screen.getByRole("img", { name: properties.alt }).tagName).toBe(
      "IMG"
    );
  });
});

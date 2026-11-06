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

  test("centers the cover when there is no framing", () => {
    render(<CommunityCoverImage {...properties} />);
    expect(
      screen.getByRole("img", { name: properties.alt }).getAttribute("style")
    ).toBeNull();
  });

  test("moves the focus with object-position at zoom 1", () => {
    render(
      <CommunityCoverImage
        {...properties}
        framing={{
          focusX: 0.2,
          focusY: 0.8,
          height: 1350,
          width: 2400,
          zoom: 1,
        }}
      />
    );
    const image = screen.getByRole("img", { name: properties.alt });
    expect(image.style.objectPosition).toBe("20% 80%");
    expect(image.style.transform).toBe("");
    expect(image.parentElement?.className ?? "").not.toContain(
      "community-cover-frame"
    );
  });

  test("scales from the focus inside a clipping frame when zoomed", () => {
    render(
      <CommunityCoverImage
        {...properties}
        framing={{
          focusX: 0.25,
          focusY: 0.5,
          height: 1350,
          width: 2400,
          zoom: 2,
        }}
      />
    );
    const image = screen.getByRole("img", { name: properties.alt });
    expect(image.style.transform).toBe("scale(2)");
    expect(image.style.transformOrigin).toBe("25% 50%");
    expect(image.parentElement?.className).toContain("community-cover-frame");
  });
});

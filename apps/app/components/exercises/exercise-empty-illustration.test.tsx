import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseEmptyIllustration } from "./exercise-empty-illustration";

afterEach(cleanup);

test("uses the exact notebook SVG supplied by the handoff", () => {
  const { container } = render(<ExerciseEmptyIllustration />);

  const image = container.querySelector("img");
  if (!image) {
    throw new Error("Expected the decorative SVG image to render.");
  }
  expect(image.getAttribute("src")).toBe("/exercises/empty-notebook.svg");
  expect(image.getAttribute("width")).toBe("160");
  expect(image.getAttribute("height")).toBe("110");
  expect(image.getAttribute("aria-hidden")).toBe("true");

  const asset = readFileSync(
    resolve(process.cwd(), "public/exercises/empty-notebook.svg"),
    "utf8"
  ).trimEnd();
  const hash = createHash("sha256").update(asset).digest("hex");
  expect(hash).toBe(
    "763314221e1037c893994242c791ab8dc77efb6310017bcf2e2901a60106bb21"
  );
});

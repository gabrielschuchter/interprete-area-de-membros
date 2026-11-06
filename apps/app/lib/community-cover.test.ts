import { describe, expect, test } from "vitest";
import {
  clampCoverZoom,
  communityCoverFramingFromForm,
  communityCoverImageStyle,
  defaultCommunityCoverFraming,
  dragCommunityCoverFraming,
  isBelowRecommendedCoverWidth,
  normalizeCommunityCoverFraming,
  visibleCommunityCoverRect,
} from "./community-cover";

const frame = { frameHeight: 360, frameWidth: 640 };

describe("community cover framing", () => {
  test("old posts (null columns) resolve to the centered default", () => {
    expect(normalizeCommunityCoverFraming(null)).toEqual(
      defaultCommunityCoverFraming
    );
    expect(communityCoverImageStyle(defaultCommunityCoverFraming)).toEqual({
      objectPosition: "50% 50%",
    });
  });

  test("clamps zoom to 1..3 and focus to 0..1", () => {
    expect(clampCoverZoom(0.2)).toBe(1);
    expect(clampCoverZoom(9)).toBe(3);
    expect(
      normalizeCommunityCoverFraming({ focusX: -2, focusY: 4, zoom: 7 })
    ).toMatchObject({ focusX: 0, focusY: 1, zoom: 3 });
  });

  test("reads and sanitizes form values", () => {
    const form = new FormData();
    form.set("coverFocusX", "0.25");
    form.set("coverFocusY", "nope");
    form.set("coverZoom", "2.5");
    form.set("coverWidth", "2400");
    form.set("coverHeight", "-1");
    expect(communityCoverFramingFromForm(form)).toEqual({
      focusX: 0.25,
      focusY: 0.5,
      height: null,
      width: 2400,
      zoom: 2.5,
    });
  });

  test("scales around the focus point", () => {
    expect(
      communityCoverImageStyle({
        ...defaultCommunityCoverFraming,
        focusX: 0.25,
        focusY: 0.75,
        zoom: 2,
      })
    ).toEqual({
      objectPosition: "25% 75%",
      transform: "scale(2)",
      transformOrigin: "25% 75%",
    });
  });

  test("the visible window never leaves the image, at any focus and zoom", () => {
    for (const imageAspect of [0.75, 1, 16 / 9, 3]) {
      for (const zoom of [1, 1.5, 3]) {
        for (const focus of [0, 0.5, 1]) {
          const rect = visibleCommunityCoverRect(
            {
              ...defaultCommunityCoverFraming,
              focusX: focus,
              focusY: focus,
              zoom,
            },
            { ...frame, imageAspect }
          );
          expect(rect.left).toBeGreaterThanOrEqual(-1e-9);
          expect(rect.top).toBeGreaterThanOrEqual(-1e-9);
          expect(rect.right).toBeLessThanOrEqual(1 + 1e-9);
          expect(rect.bottom).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  test("dragging follows the pointer and stops at the edges", () => {
    const geometry = { ...frame, imageAspect: 2 };
    const start = { ...defaultCommunityCoverFraming, zoom: 1.5 };
    const before = visibleCommunityCoverRect(start, geometry);
    const dragged = dragCommunityCoverFraming(start, { x: 40, y: 0 }, geometry);
    const after = visibleCommunityCoverRect(dragged, geometry);
    // 40 px para a direita revela conteúdo mais à esquerda.
    expect(after.left).toBeLessThan(before.left);
    const pinned = dragCommunityCoverFraming(
      start,
      { x: 99_999, y: 99_999 },
      geometry
    );
    expect(pinned.focusX).toBe(0);
    expect(pinned.focusY).toBe(0);
    const other = dragCommunityCoverFraming(
      start,
      { x: -99_999, y: -99_999 },
      geometry
    );
    expect(other.focusX).toBe(1);
    expect(other.focusY).toBe(1);
  });

  test("an image already 16:9 at zoom 1 has nothing to drag", () => {
    const geometry = { ...frame, imageAspect: 16 / 9 };
    const moved = dragCommunityCoverFraming(
      defaultCommunityCoverFraming,
      { x: 50, y: 50 },
      geometry
    );
    expect(moved).toEqual(defaultCommunityCoverFraming);
  });

  test("warns below 1600 px without blocking", () => {
    expect(isBelowRecommendedCoverWidth(680)).toBe(true);
    expect(isBelowRecommendedCoverWidth(1600)).toBe(false);
    expect(isBelowRecommendedCoverWidth(null)).toBe(false);
  });
});

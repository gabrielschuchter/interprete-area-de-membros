import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CommunityAvatars,
  initialCommunityAvatarSlots,
  pickCommunityAvatarSwap,
} from "./community-avatars";

const avatars = "ABCDEFGHIJ".split("").map((initials) => ({
  avatarUrl: null,
  initials,
}));

const visibleInitials = () =>
  [
    ...screen
      .getByTestId("community-avatars")
      .querySelectorAll(".community-avatars__item"),
  ].map((item) => {
    const layers = item.querySelectorAll(".community-avatars__layer");
    return layers[layers.length - 1]?.textContent ?? "";
  });

describe("CommunityAvatars", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("starts with a bounded decorative window and no identity text", () => {
    expect(initialCommunityAvatarSlots(avatars)).toEqual([0, 1, 2, 3, 4, 5, 6]);

    render(<CommunityAvatars avatars={avatars} />);
    expect(visibleInitials().join("")).toBe("ABCDEFG");
    expect(
      screen.getByTestId("community-avatars").getAttribute("aria-hidden")
    ).toBe("true");
  });

  test("a swap never repeats a face that is already visible", () => {
    const slots = [0, 1, 2, 3, 4, 5, 6];
    for (let seed = 0; seed < 50; seed += 1) {
      const swap = pickCommunityAvatarSwap(10, slots, () => (seed % 10) / 10);
      expect(swap).not.toBeNull();
      expect(slots).not.toContain(swap?.avatar);
    }
    expect(pickCommunityAvatarSwap(7, slots)).toBeNull();
  });

  test("swaps one position every 5 to 8 seconds and pauses while the tab is hidden", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const originalVisibility = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState"
    );
    let visibilityState: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });

    try {
      render(<CommunityAvatars avatars={avatars} />);
      act(() => vi.advanceTimersByTime(5100));
      expect(visibleInitials().join("")).toBe("HBCDEFG");

      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      act(() => vi.advanceTimersByTime(30_000));
      expect(visibleInitials().join("")).toBe("HBCDEFG");

      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      act(() => vi.advanceTimersByTime(5100));
      // With random pinned at 0 the first free face is picked again: "A" left slot 0 and is free.
      expect(visibleInitials().join("")).toBe("ABCDEFG");
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
    }
  });
});

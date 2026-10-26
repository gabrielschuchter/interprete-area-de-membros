import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CommunityAvatars,
  rotateCommunityAvatarVisuals,
} from "./community-avatars";

const avatars = "ABCDEFGH".split("").map((initials) => ({
  avatarUrl: null,
  initials,
}));

const visibleInitials = () =>
  screen.getByTestId("community-avatars").textContent;

describe("CommunityAvatars", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("rotates a bounded decorative window without exposing identity text", () => {
    expect(
      rotateCommunityAvatarVisuals(avatars, 0).map(({ initials }) => initials)
    ).toEqual([..."ABCDEFG"]);
    expect(
      rotateCommunityAvatarVisuals(avatars, 1).map(({ initials }) => initials)
    ).toEqual([..."BCDEFGH"]);

    render(<CommunityAvatars avatars={avatars} />);
    expect(visibleInitials()).toBe("ABCDEFG");
    expect(
      screen.getByTestId("community-avatars").getAttribute("aria-hidden")
    ).toBe("true");
  });

  test("pauses rotation while the browser tab is hidden and resumes when visible", () => {
    vi.useFakeTimers();
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
      act(() => vi.advanceTimersByTime(6500));
      expect(visibleInitials()).toBe("BCDEFGH");

      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      act(() => vi.advanceTimersByTime(13_000));
      expect(visibleInitials()).toBe("BCDEFGH");

      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      act(() => vi.advanceTimersByTime(6500));
      expect(visibleInitials()).toBe("CDEFGHA");
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
    }
  });
});

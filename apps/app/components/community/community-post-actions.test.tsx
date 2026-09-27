import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const actionHarness = vi.hoisted(() => ({
  bookmark: vi.fn(() => Promise.resolve()),
  vote: vi.fn(() => Promise.resolve()),
}));
const routerHarness = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/app/(authenticated)/comunidade/actions", () => ({
  toggleBookmark: actionHarness.bookmark,
  togglePostVote: actionHarness.vote,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerHarness,
}));

import { CommunityPostActions } from "./community-post-actions";

describe("CommunityPostActions", () => {
  afterEach(() => {
    cleanup();
    actionHarness.bookmark.mockClear();
    actionHarness.vote.mockClear();
    routerHarness.refresh.mockClear();
  });

  test("updates a vote immediately and ignores a second click while pending", async () => {
    render(
      <CommunityPostActions
        initialBookmarked={false}
        initialVoted={false}
        postId="post-1"
        spaceSlug="space-1"
        voteCount={2}
      />
    );

    const vote = screen.getByRole("button", { name: "Apoiar conteúdo" });
    fireEvent.click(vote);
    fireEvent.click(vote);

    expect(vote.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("3")).toBeTruthy();
    expect(actionHarness.vote).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(routerHarness.refresh).toHaveBeenCalledTimes(1));
  });

  test("rolls back the optimistic state when the server action fails", async () => {
    actionHarness.vote.mockRejectedValueOnce(new Error("temporary failure"));

    render(
      <CommunityPostActions
        initialBookmarked={false}
        initialVoted={false}
        postId="post-1"
        spaceSlug="space-1"
        voteCount={0}
      />
    );

    const vote = screen.getByRole("button", { name: "Apoiar conteúdo" });
    fireEvent.click(vote);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(vote.getAttribute("aria-pressed")).toBe("false");
    });
    expect(routerHarness.refresh).not.toHaveBeenCalled();
  });
});

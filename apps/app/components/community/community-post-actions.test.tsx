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

vi.mock("@/app/(authenticated)/comunidade/actions", () => ({
  toggleBookmark: actionHarness.bookmark,
  togglePostVote: actionHarness.vote,
}));

import { CommunityPostActions } from "./community-post-actions";

const renderActions = (voteCount = 2) =>
  render(
    <CommunityPostActions
      initialBookmarked={false}
      initialVoted={false}
      postId="post-1"
      sharePath="/comunidade/publicacoes/post-1"
      spaceSlug="space-1"
      voteCount={voteCount}
    />
  );

describe("CommunityPostActions", () => {
  afterEach(() => {
    cleanup();
    actionHarness.bookmark.mockReset();
    actionHarness.bookmark.mockImplementation(() => Promise.resolve());
    actionHarness.vote.mockReset();
    actionHarness.vote.mockImplementation(() => Promise.resolve());
  });

  test("updates a vote immediately and ignores a second click while pending", async () => {
    renderActions();

    const vote = screen.getByRole("button", { name: "Apoiar conteúdo" });
    fireEvent.click(vote);
    fireEvent.click(vote);

    expect(vote.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("3")).toBeTruthy();
    expect(actionHarness.vote).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(vote.getAttribute("aria-busy")).toBeNull());
  });

  test("saving does not disable or change the vote button", async () => {
    let finishBookmark: () => void = () => undefined;
    actionHarness.bookmark.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishBookmark = resolve;
        })
    );
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Salvar publicação" }));
    const vote = screen.getByRole("button", { name: "Apoiar conteúdo" });
    expect(vote.hasAttribute("disabled")).toBe(false);
    expect(vote.getAttribute("aria-busy")).toBeNull();

    fireEvent.click(vote);
    expect(actionHarness.vote).toHaveBeenCalledTimes(1);
    finishBookmark();
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Remover dos salvos" })
          .getAttribute("aria-pressed")
      ).toBe("true")
    );
    expect(
      screen
        .getByRole("button", { name: "Remover apoio" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  test("rolls back the optimistic state when the server action fails", async () => {
    actionHarness.vote.mockRejectedValueOnce(new Error("temporary failure"));
    renderActions(0);

    const vote = screen.getByRole("button", { name: "Apoiar conteúdo" });
    fireEvent.click(vote);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(vote.getAttribute("aria-pressed")).toBe("false");
    });
  });

  test("share copies the direct link and confirms it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/comunidade/publicacoes/post-1`
      )
    );
    expect(await screen.findAllByText("Link copiado")).not.toHaveLength(0);
  });
});

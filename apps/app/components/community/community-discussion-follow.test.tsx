import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityDiscussionFollow } from "./community-discussion-follow";

vi.mock("@/app/(authenticated)/comunidade/actions", () => ({
  toggleTopicFollow: vi.fn(),
  toggleTopicMute: vi.fn(),
}));

describe("CommunityDiscussionFollow", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the following state and its matching class", () => {
    render(
      <CommunityDiscussionFollow
        isFollowing
        isMuted={false}
        postId="post-1"
        spaceSlug=""
      />
    );

    const button = screen.getByRole("button", { name: "Silenciar discussão" });
    expect(button.textContent).toContain("Seguindo discussão");
    expect(button.classList).toContain("community-follow-button");
    expect(button.classList).toContain("is-following");
  });

  test("shows the muted state and its matching class", () => {
    render(
      <CommunityDiscussionFollow
        isFollowing
        isMuted
        postId="post-1"
        spaceSlug=""
      />
    );

    const button = screen.getByRole("button", {
      name: "Ativar notificações da discussão",
    });
    expect(button.textContent).toContain("Silenciada");
    expect(button.classList).toContain("is-muted");
  });
});

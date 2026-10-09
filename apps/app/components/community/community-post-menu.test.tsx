import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityPostMenu } from "./community-post-menu";

vi.mock("next/link", () => ({
  default: (properties: ComponentProps<"a">) => <a {...properties} />,
}));

vi.mock("@/app/(authenticated)/comunidade/actions", () => ({
  setPostStatus: vi.fn(),
  softDeletePost: vi.fn(),
  togglePostFeatured: vi.fn(),
  togglePostPin: vi.fn(),
}));

describe("CommunityPostMenu", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows owner actions and requires delete confirmation", () => {
    render(
      <CommunityPostMenu
        canModerate={false}
        isFeatured={false}
        isPinned={false}
        postId="post-1"
        spaceSlug=""
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ações da publicação" })
    );
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Arquivar" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Fixar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Destacar" })).toBeNull();

    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    expect(screen.getByText("Excluir publicação?")).toBeTruthy();
    expect(
      screen.getByRole("menu", { name: "Confirmar exclusão da publicação" })
        .classList
    ).toContain("is-confirming-delete");
    expect(screen.getByRole("menuitem", { name: "Cancelar" })).toBeTruthy();
  });

  test("adds independent pin and feature actions for moderators", () => {
    render(
      <CommunityPostMenu
        canModerate
        isFeatured
        isPinned
        postId="post-1"
        spaceSlug=""
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ações da publicação" })
    );
    expect(screen.getByRole("menuitem", { name: "Desafixar" })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "Retirar destaque" })
    ).toBeTruthy();
  });
});

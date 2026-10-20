import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { togglePostPin } from "@/app/(authenticated)/comunidade/actions";
import { CommunityPostMenu } from "./community-post-menu";

vi.mock("next/link", () => ({
  default: (properties: ComponentProps<"a">) => <a {...properties} />,
}));

vi.mock("@/app/(authenticated)/comunidade/actions", () => ({
  setPostStatus: vi.fn(),
  undoSoftDeletedPost: vi.fn(),
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
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Excluir publicação?" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
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

  test("keeps the menu open and announces a pin conflict", async () => {
    vi.mocked(togglePostPin).mockResolvedValue({
      ok: false,
      error:
        "A fixação foi alterada ao mesmo tempo. Atualize e tente novamente.",
    });
    render(
      <CommunityPostMenu
        canModerate
        isFeatured={false}
        isPinned={false}
        postId="post-1"
        spaceSlug=""
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ações da publicação" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Fixar" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "A fixação foi alterada ao mesmo tempo. Atualize e tente novamente."
    );
    expect(
      screen
        .getByRole("button", { name: "Ações da publicação" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  test("requires confirmation before deleting a draft without published actions", () => {
    render(
      <CommunityPostMenu
        canModerate
        isFeatured={false}
        isPinned={false}
        postId="draft-1"
        spaceSlug=""
        status="DRAFT"
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ações da publicação" })
    );
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Arquivar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Fixar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Destacar" })).toBeNull();

    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Excluir rascunho?" })
    ).toBeTruthy();
  });
});

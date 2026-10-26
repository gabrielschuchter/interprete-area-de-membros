import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommunityPublicationViewSelector } from "./community-publication-view-selector";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("keeps search and sort when changing the mobile publication status", () => {
  render(
    <CommunityPublicationViewSelector
      activeView="drafts"
      counts={{ archived: 1, drafts: 4, published: 8 }}
      query="aula"
      sort="oldest"
    />
  );

  fireEvent.change(
    screen.getByRole("combobox", {
      name: "Situação das publicações em dispositivos móveis",
    }),
    {
      target: { value: "archived" },
    }
  );

  expect(router.push).toHaveBeenCalledWith(
    "/comunidade/minhas-publicacoes?status=archived&q=aula&sort=oldest"
  );
});

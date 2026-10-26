import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CommunityFeedNavigation,
  CommunityNavigation,
} from "./community-navigation";
import CommunityViewPicker from "./community-view-picker";
import { communityViews } from "./community-views";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly children: ReactNode;
    readonly href: string;
    readonly prefetch?: boolean;
  }) => (
    <a
      data-prefetch={prefetch === true ? "enabled" : "disabled"}
      {...props}
      href={href}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/comunidade",
  useSearchParams: () => ({ toString: () => "" }),
  useRouter: () => ({ push: routerPush }),
}));

describe("CommunityNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("preserves search, type, group, and sort filters in the URL", () => {
    render(
      <CommunityFeedNavigation
        kind="QUESTION"
        query="método"
        sort="unanswered"
        spaceSlug="pratica-clinica"
        spaces={[
          { slug: "pratica-clinica", title: "Prática clínica" },
          { slug: "metodo", title: "Método" },
        ]}
      />
    );

    const groupSelect = screen.getByRole("combobox", {
      name: "Filtrar por grupo de estudo",
    }) as HTMLSelectElement;
    const sortSelect = screen.getByRole("combobox", {
      name: "Ordenar publicações",
    }) as HTMLSelectElement;
    const kindSelect = screen.getByRole("combobox", {
      name: "Filtrar por tipo de publicação",
    }) as HTMLSelectElement;
    expect(groupSelect.value).toBe("pratica-clinica");
    expect(sortSelect.value).toBe("unanswered");
    expect(kindSelect.value).toBe("QUESTION");

    fireEvent.change(sortSelect, { target: { value: "popular" } });
    expect(routerPush).toHaveBeenCalledWith(
      "/comunidade?q=m%C3%A9todo&tipo=QUESTION&sort=popular&space=pratica-clinica"
    );

    fireEvent.change(kindSelect, { target: { value: "" } });
    expect(routerPush).toHaveBeenLastCalledWith(
      "/comunidade?q=m%C3%A9todo&sort=unanswered&space=pratica-clinica"
    );
  });

  test("marks the primary community destination without duplicating actions", () => {
    render(<CommunityNavigation active="saved" />);

    expect(
      screen.getByRole("link", { name: "Salvos" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Minhas publicações" })
        .getAttribute("href")
    ).toBe("/comunidade/minhas-publicacoes");
    expect(
      screen.getByRole("link", { name: "Encontros" }).getAttribute("href")
    ).toBe("/comunidade/encontros");
    expect(
      screen.getByRole("link", { name: "Grupos" }).getAttribute("href")
    ).toBe("/comunidade/grupos");
  });

  test("opens the mobile sheet with all five destinations", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((media: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });

    render(<CommunityViewPicker activeView={communityViews[0]} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Visão da comunidade: Explorar",
      })
    );

    expect(screen.getByRole("heading", { name: "Comunidade" })).toBeTruthy();
    expect(screen.getAllByRole("link").length).toBe(5);
    expect(screen.getByText("Feed da comunidade")).toBeTruthy();
    expect(screen.getByText("Meus grupos e descoberta")).toBeTruthy();
    expect(screen.getByText("Próximos e gravações")).toBeTruthy();
    expect(screen.getByText("Só da Comunidade")).toBeTruthy();
    expect(screen.getByText("Publicadas, rascunhos e arquivadas")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Fechar visões da comunidade" })
    ).toBeTruthy();
  });
});

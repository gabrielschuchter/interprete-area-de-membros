import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CommunityFeedNavigation,
  CommunityNavigation,
} from "./community-navigation";

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

  test("preserves combined feed filters in the group and sort selectors", () => {
    render(
      <CommunityFeedNavigation
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
    expect(groupSelect.value).toBe("pratica-clinica");
    expect(sortSelect.value).toBe("unanswered");

    fireEvent.change(sortSelect, { target: { value: "popular" } });
    expect(routerPush).toHaveBeenCalledWith(
      "/comunidade?q=m%C3%A9todo&sort=popular&space=pratica-clinica"
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
    ).toBe("/comunidade/meus-topicos");
  });
});

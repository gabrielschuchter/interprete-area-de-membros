import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityFeedNavigation } from "./community-navigation";

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

describe("CommunityFeedNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("preserves search, group, and sort filters (no type filter) in the URL", () => {
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
    expect(
      screen.queryByRole("combobox", { name: "Filtrar por tipo de publicação" })
    ).toBeNull();

    fireEvent.change(sortSelect, { target: { value: "popular" } });
    expect(routerPush).toHaveBeenCalledWith(
      "/comunidade?q=m%C3%A9todo&sort=popular&space=pratica-clinica"
    );
  });
});

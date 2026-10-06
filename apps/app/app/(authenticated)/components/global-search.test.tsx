import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { GlobalSearchResult } from "@/lib/global-search";

const { navigationState, routerMock } = vi.hoisted(() => ({
  navigationState: { pathname: "/biblioteca", search: "" },
  routerMock: { prefetch: vi.fn(), push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
  useRouter: () => routerMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    ...properties
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly href: string;
    readonly prefetch?: boolean;
  }) => (
    <a
      data-prefetch={prefetch === false ? "disabled" : "enabled"}
      href={href}
      {...properties}
    />
  ),
}));

import { GlobalSearch } from "./global-search";
import { resetNavigationPrefetchBudget } from "./navigation-prefetch";

const results: GlobalSearchResult[] = [
  {
    context: null,
    href: "/biblioteca/primeiro",
    id: "primeiro",
    title: "Primeiro material",
    type: "library",
    typeLabel: "Biblioteca",
  },
  {
    context: null,
    href: "/biblioteca/segundo",
    id: "segundo",
    title: "Segundo material",
    type: "library",
    typeLabel: "Biblioteca",
  },
  {
    context: null,
    href: "/biblioteca/terceiro",
    id: "terceiro",
    title: "Terceiro material",
    type: "library",
    typeLabel: "Biblioteca",
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  routerMock.prefetch.mockReset();
  routerMock.push.mockReset();
  resetNavigationPrefetchBudget();
});

describe("GlobalSearch result prefetch", () => {
  test("prefetches only the active results within the route budget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ results }),
        ok: true,
      })
    );

    render(<GlobalSearch onOpenChange={vi.fn()} open />);
    const input = screen.getByRole("combobox", {
      name: "Buscar no Interprete",
    });

    fireEvent.change(input, { target: { value: "epidemiologia" } });

    const firstResult = await screen.findByRole("option", {
      name: (accessibleName) => accessibleName.startsWith("Primeiro material"),
    });
    await waitFor(() =>
      expect(routerMock.prefetch).toHaveBeenCalledExactlyOnceWith(
        "/biblioteca/primeiro"
      )
    );
    expect(firstResult.getAttribute("data-prefetch")).toBe("disabled");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(routerMock.prefetch).toHaveBeenCalledTimes(2));
    expect(routerMock.prefetch).toHaveBeenLastCalledWith("/biblioteca/segundo");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(routerMock.prefetch).toHaveBeenCalledTimes(2);
  });
});

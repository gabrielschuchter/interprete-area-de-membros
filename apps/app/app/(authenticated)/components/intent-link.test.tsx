import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

const navigationState = vi.hoisted(() => ({ pathname: "/origem", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => ({ toString: () => navigationState.search }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    ...properties
  }: ComponentProps<"a"> & { readonly prefetch?: boolean }) => (
    <a
      data-href={href}
      data-prefetch={prefetch === true ? "full" : "disabled"}
      href={href}
      {...properties}
    />
  ),
}));

import { IntentLink } from "./intent-link";
import { resetNavigationPrefetchBudget } from "./navigation-prefetch";

afterEach(() => {
  cleanup();
  resetNavigationPrefetchBudget();
  navigationState.pathname = "/origem";
  navigationState.search = "";
});

describe("IntentLink", () => {
  test("does not prefetch until the user expresses intent", () => {
    render(<IntentLink href="/destino">Abrir destino</IntentLink>);

    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe(
      "disabled"
    );

    fireEvent.pointerEnter(screen.getByRole("link"));

    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe("full");
  });

  test("enables full prefetch for keyboard focus and bounds destinations per route", () => {
    render(
      <>
        <IntentLink href="/primeiro">Primeiro destino</IntentLink>
        <IntentLink href="/segundo">Segundo destino</IntentLink>
        <IntentLink href="/terceiro">Terceiro destino</IntentLink>
      </>
    );

    fireEvent.focus(screen.getByRole("link", { name: "Primeiro destino" }));
    fireEvent.focus(screen.getByRole("link", { name: "Segundo destino" }));
    fireEvent.focus(screen.getByRole("link", { name: "Terceiro destino" }));

    expect(
      screen
        .getByRole("link", { name: "Primeiro destino" })
        .getAttribute("data-prefetch")
    ).toBe("full");
    expect(
      screen
        .getByRole("link", { name: "Segundo destino" })
        .getAttribute("data-prefetch")
    ).toBe("full");
    expect(
      screen
        .getByRole("link", { name: "Terceiro destino" })
        .getAttribute("data-prefetch")
    ).toBe("disabled");
  });

  test("clears a stale intent when navigation changes the current route", () => {
    const { rerender } = render(
      <IntentLink href="/destino">Abrir destino</IntentLink>
    );
    const link = screen.getByRole("link");

    fireEvent.pointerEnter(link);
    expect(link.getAttribute("data-prefetch")).toBe("full");

    navigationState.pathname = "/destino";
    rerender(<IntentLink href="/destino">Abrir destino</IntentLink>);
    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe(
      "disabled"
    );

    navigationState.pathname = "/origem";
    rerender(<IntentLink href="/destino">Abrir destino</IntentLink>);
    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe(
      "disabled"
    );
  });

  test("starts a new intent budget when only the query string changes", () => {
    const { rerender } = render(
      <IntentLink href="/admin/library?page=2">Próxima página</IntentLink>
    );
    const nextPage = screen.getByRole("link", { name: "Próxima página" });

    fireEvent.focus(nextPage);
    expect(nextPage.getAttribute("data-prefetch")).toBe("full");

    navigationState.pathname = "/admin/library";
    navigationState.search = "page=2";
    rerender(
      <IntentLink href="/admin/library?page=3">Próxima página</IntentLink>
    );
    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe(
      "disabled"
    );

    fireEvent.focus(screen.getByRole("link"));
    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe("full");
  });

  test("does not intercept modified activation or call navigation feedback", () => {
    const onNavigationStart = vi.fn();
    render(
      <IntentLink href="/destino" onNavigationStart={onNavigationStart}>
        Abrir destino
      </IntentLink>
    );

    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(screen.getByRole("link"), { ctrlKey: true });

    expect(onNavigationStart).not.toHaveBeenCalled();
    expect(screen.getByRole("link").getAttribute("data-prefetch")).toBe(
      "disabled"
    );
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CommunityFeedNavigation,
  CommunityNavigation,
} from "./community-navigation";

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
}));

describe("CommunityNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("preserves all combined feed filters in discovery links", () => {
    render(
      <CommunityFeedNavigation
        query="método"
        sort="unanswered"
        spaceSlug="pratica-clinica"
      />
    );

    expect(
      screen
        .getByRole("link", { name: "Sem resposta" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Em alta" }).getAttribute("href")
    ).toBe("/comunidade?q=m%C3%A9todo&sort=popular&space=pratica-clinica");
    expect(
      screen.getByRole("navigation", { name: "Descoberta do feed" }).textContent
    ).not.toContain("Formato");
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

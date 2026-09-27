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
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly children: ReactNode;
    readonly href: string;
  }) => (
    <a {...props} href={href}>
      {children}
    </a>
  ),
}));

describe("CommunityNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("preserves all combined feed filters in discovery links", () => {
    render(
      <CommunityFeedNavigation
        kind="QUESTION"
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
    ).toBe(
      "/comunidade?q=m%C3%A9todo&sort=popular&kind=QUESTION&space=pratica-clinica"
    );
    expect(
      screen.getByRole("link", { name: "Todos" }).getAttribute("href")
    ).toBe("/comunidade?q=m%C3%A9todo&sort=unanswered&space=pratica-clinica");
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

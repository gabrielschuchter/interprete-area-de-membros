import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityRightRail } from "./community-right-rail";

const clinicalSpaceName = /Prática clínica/;
const announcementName = /Roda de discussão/;
const onlineStatusPattern = /online|membros ativos|ativo agora/i;

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
  }: {
    readonly children: ReactNode;
    readonly href: string;
    readonly prefetch?: boolean;
  }) => (
    <a data-prefetch={prefetch === true ? "enabled" : "disabled"} href={href}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/comunidade",
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => ({ toString: () => "" }),
}));

describe("CommunityRightRail", () => {
  afterEach(() => {
    cleanup();
  });

  test("links the Escola Intérprete platforms in a new tab, in order", () => {
    render(
      <CommunityRightRail
        announcements={[]}
        avatars={[]}
        goalCard={null}
        spaces={[]}
      />
    );
    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("target") === "_blank");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://chat.whatsapp.com/HQMIrtQ5zxYElvJtjQfnvG",
      "https://www.instagram.com/escola.interprete/",
      "https://substack.com/@interprete",
      "https://linktr.ee/interprete",
    ]);
    for (const link of links) {
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("aria-label")).toBeTruthy();
    }
  });

  test("keeps the requested blocks in board order and links real spaces", () => {
    render(
      <CommunityRightRail
        announcements={[
          {
            body: "A próxima roda acontece na quinta.",
            createdAt: new Date("2026-09-27T12:00:00.000Z"),
            groupKey: "announcement:1",
            href: "/encontros",
            id: "announcement-1",
            version: 1,
            title: "Roda de discussão",
          },
        ]}
        avatars={[
          {
            avatarUrl: null,
            displayName: "Ana Souza",
            initials: "A",
            username: "ana",
          },
        ]}
        goalCard={<div data-testid="goal-summary">Meta coletiva</div>}
        spaces={[
          {
            _count: { posts: 12 },
            id: "space-1",
            slug: "pratica-clinica",
            title: "Prática clínica",
          },
        ]}
      />
    );

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual([
      "Pessoas da comunidade",
      "Escola Intérprete",
      "Grupos de estudo",
      "Avisos",
      "Sobre a comunidade",
    ]);
    expect(screen.getByTestId("goal-summary")).toBeTruthy();
    expect(
      screen
        .getByTestId("community-avatars")
        .querySelector("a")
        ?.getAttribute("href")
    ).toBe("/membros/ana?returnTo=%2Fcomunidade");
    expect(screen.queryByText(onlineStatusPattern)).toBeNull();
    expect(
      screen.getByRole("link", { name: clinicalSpaceName }).getAttribute("href")
    ).toBe("/comunidade/grupos/pratica-clinica");
    expect(
      screen.getByRole("link", { name: announcementName }).getAttribute("href")
    ).toBe("/encontros");
  });

  test("omits the notices block when there is no notice", () => {
    render(
      <CommunityRightRail
        announcements={[]}
        avatars={[]}
        goalCard={<div data-testid="goal-summary">Meta coletiva</div>}
        spaces={[]}
      />
    );

    expect(screen.queryByText("Nenhum aviso recente.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Avisos" })).toBeNull();
    expect(
      screen.getByText("Você ainda não participa de nenhum grupo.")
    ).toBeTruthy();
  });

  test("opens approved community guidance by default", () => {
    render(
      <CommunityRightRail
        announcements={[]}
        avatars={[]}
        goalCard={<div data-testid="goal-summary">Meta coletiva</div>}
        spaces={[]}
      />
    );

    const aboutDisclosure = screen.getByRole("button", {
      name: "Sobre a comunidade",
    });

    expect(screen.queryByRole("button", { name: "Avisos" })).toBeNull();
    expect(aboutDisclosure.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(aboutDisclosure);
    expect(aboutDisclosure.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.getByText("Discorde do argumento, nunca da pessoa.")
    ).toBeTruthy();
    expect(screen.getByText("Como participar")).toBeTruthy();
  });

  test("does not turn an unsafe notice URL into a navigable link", () => {
    render(
      <CommunityRightRail
        announcements={[
          {
            body: null,
            createdAt: new Date("2026-09-27T12:00:00.000Z"),
            groupKey: "announcement:unsafe",
            href: "javascript:alert(1)",
            id: "announcement-unsafe",
            version: 1,
            title: "Aviso sem destino seguro",
          },
        ]}
        avatars={[]}
        goalCard={<div data-testid="goal-summary">Meta coletiva</div>}
        spaces={[]}
      />
    );

    expect(
      screen.queryByRole("link", { name: "Aviso sem destino seguro" })
    ).toBeNull();
    expect(screen.getByText("Aviso sem destino seguro")).toBeTruthy();
  });
});

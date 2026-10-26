import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityRightRail } from "./community-right-rail";

vi.mock("@/app/(authenticated)/comunidade/announcements-actions", () => ({
  dismissCommunityAnnouncement: vi.fn(async () => "dismissed"),
}));

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

  test("keeps the four requested blocks in order and links real spaces", () => {
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
        avatars={[{ avatarUrl: null, initials: "A" }]}
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
      "Sobre a comunidade",
      "Pessoas da comunidade",
      "Grupos de estudo",
      "Avisos",
    ]);
    expect(screen.getByTestId("goal-summary")).toBeTruthy();
    expect(
      screen.getByTestId("community-avatars").getAttribute("aria-hidden")
    ).toBe("true");
    expect(screen.queryByText(onlineStatusPattern)).toBeNull();
    expect(
      screen.getByRole("link", { name: clinicalSpaceName }).getAttribute("href")
    ).toBe("/comunidade/grupos/pratica-clinica");
    expect(
      screen.getByRole("link", { name: announcementName }).getAttribute("href")
    ).toBe("/encontros");
  });

  test("renders a compact empty notice state without inventing content", () => {
    render(
      <CommunityRightRail
        announcements={[]}
        avatars={[]}
        goalCard={<div data-testid="goal-summary">Meta coletiva</div>}
        spaces={[]}
      />
    );

    expect(screen.getByText("Nenhum aviso recente.")).toBeTruthy();
    expect(screen.getByText("Nenhum grupo publicado ainda.")).toBeTruthy();
  });

  test("opens approved community guidance by default and keeps notices independent", () => {
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
    const noticesDisclosure = screen.getByRole("button", { name: "Avisos" });

    expect(aboutDisclosure.getAttribute("aria-expanded")).toBe("true");
    expect(noticesDisclosure.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(aboutDisclosure);
    expect(aboutDisclosure.getAttribute("aria-expanded")).toBe("false");
    expect(noticesDisclosure.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Respeite quem pensa diferente.")).toBeTruthy();
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

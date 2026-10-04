import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityRightRail } from "./community-right-rail";

const clinicalSpaceName = /Prática clínica/;
const announcementName = /Roda de discussão/;

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    readonly children: ReactNode;
    readonly href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("./community-presence", () => ({
  CommunityPresence: () => (
    <div data-testid="mock-community-presence">2 membros online</div>
  ),
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
            title: "Roda de discussão",
          },
        ]}
        memberId="ana-id"
        profile={{
          avatarUrl: null,
          displayName: "Ana",
          username: "ana",
        }}
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
      "Ativo agora",
      "Grupos de estudo",
      "Avisos",
    ]);
    expect(screen.getByTestId("mock-community-presence").textContent).toContain(
      "2 membros online"
    );
    expect(
      screen.getByRole("link", { name: clinicalSpaceName }).getAttribute("href")
    ).toBe("/comunidade/pratica-clinica");
    expect(
      screen.getByRole("link", { name: announcementName }).getAttribute("href")
    ).toBe("/encontros");
  });

  test("renders a compact empty notice state without inventing content", () => {
    render(
      <CommunityRightRail
        announcements={[]}
        memberId="ana-id"
        profile={null}
        spaces={[]}
      />
    );

    expect(screen.getByText("Nenhum aviso recente.")).toBeTruthy();
    expect(screen.getByText("Nenhum grupo publicado ainda.")).toBeTruthy();
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
            title: "Aviso sem destino seguro",
          },
        ]}
        memberId="ana-id"
        profile={null}
        spaces={[]}
      />
    );

    expect(
      screen.queryByRole("link", { name: "Aviso sem destino seguro" })
    ).toBeNull();
    expect(screen.getByText("Aviso sem destino seguro")).toBeTruthy();
  });
});

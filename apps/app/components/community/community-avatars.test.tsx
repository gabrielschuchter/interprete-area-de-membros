import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityAvatars } from "./community-avatars";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    readonly children: ReactNode;
    readonly href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/comunidade",
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => ({ toString: () => "" }),
}));

const avatars = "ABCDEFGHIJ".split("").map((initials) => ({
  avatarUrl: null,
  displayName: `Pessoa ${initials}`,
  initials,
  username: `pessoa-${initials.toLowerCase()}`,
}));

describe("CommunityAvatars", () => {
  afterEach(cleanup);

  test("renders every person as a link to the public profile, in a single row", () => {
    render(<CommunityAvatars avatars={avatars} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(avatars.length);
    expect(links[0]?.getAttribute("href")).toBe(
      "/membros/pessoa-a?returnTo=%2Fcomunidade"
    );
    expect(links[0]?.getAttribute("aria-label")).toBe(
      "Abrir perfil de Pessoa A"
    );
    expect(links[0]?.getAttribute("title")).toBe("Pessoa A");
    expect(
      screen.getByTestId("community-avatars").textContent?.replace(/\s/g, "")
    ).toBe("ABCDEFGHIJ");
  });

  test("renders nothing clickable for an empty pool", () => {
    render(<CommunityAvatars avatars={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

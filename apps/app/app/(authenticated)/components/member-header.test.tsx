import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, expect, test, vi } from "vitest";

const route = vi.hoisted(() => ({
  pathname: "/exercicios/listas/biostatistica",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => route.searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { readonly href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/design-system/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">Menu</button>,
}));

vi.mock("@repo/design-system/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("./member-header-controls", () => ({
  MemberHeaderControls: () => <div>Header actions</div>,
}));

import { MemberHeader } from "./member-header";

afterEach(() => {
  cleanup();
  route.pathname = "/exercicios/listas/biostatistica";
  route.searchParams = new URLSearchParams();
});

test("uses the handoff back header on mobile exercise detail routes", () => {
  render(<MemberHeader memberId="member-1" />);

  const backLink = screen.getByRole("link", {
    name: "Voltar para Exercícios",
  });
  expect(backLink.getAttribute("href")).toBe("/exercicios");
  expect(screen.getByRole("banner").className).toContain("h-14");
});

test("hides the generic mobile shell header during an active list session", () => {
  route.pathname = "/exercicios/sessoes/session-1";
  render(<MemberHeader memberId="member-1" />);

  expect(screen.getByRole("banner").className).toContain("hidden md:flex");
});

test("hides the generic mobile shell header during an individual favorite attempt", () => {
  route.pathname = "/exercicios/favoritas/question-1";
  route.searchParams = new URLSearchParams("sessao=favorite-session-1");
  render(<MemberHeader memberId="member-1" />);

  expect(screen.getByRole("banner").className).toContain("hidden md:flex");
});

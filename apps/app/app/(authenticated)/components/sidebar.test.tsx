import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GlobalSidebar } from "./sidebar";

const { currentPath } = vi.hoisted(() => ({ currentPath: { value: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath.value,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { readonly href: string }) => (
    <a {...props} href={href}>
      {children}
    </a>
  ),
}));

const originalMatchMedia = window.matchMedia;

const setMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((media: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
};

const renderSidebarAt = (pathname: string) => {
  currentPath.value = pathname;
  setMatchMedia();

  return render(
    <SidebarProvider>
      <GlobalSidebar
        avatarUrl={null}
        canManageContent={false}
        displayName="Aluno QA"
        productConfig={{ showLearnNavigation: true }}
      >
        <main>Conteúdo</main>
      </GlobalSidebar>
    </SidebarProvider>
  );
};

const personalLinks = () => {
  const group = screen.getByRole("group", { name: "Conteúdo pessoal" });
  const links = within(group).getAllByRole("link");

  return { group, links };
};

describe("GlobalSidebar personal content group", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  test("renders recordings above saved content in a distinct top group", () => {
    renderSidebarAt("/");

    const { group, links } = personalLinks();
    const groups = document.querySelectorAll('[data-sidebar="group"]');

    expect(groups[0]).toBe(group);
    expect(group.closest('[data-sidebar="header"]')).not.toBeNull();
    expect(group.closest('[data-sidebar="content"]')).toBeNull();
    expect(group.getAttribute("role")).toBe("group");
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Minhas gravações",
      "Salvos",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/encontros/gravacoes",
      "/comunidade/salvos",
    ]);
  });

  test("provides a keyboard skip link before navigation without nesting main landmarks", () => {
    renderSidebarAt("/");

    const skipLink = screen.getByRole("link", {
      name: "Pular para o conteúdo principal",
    });
    expect(skipLink.getAttribute("href")).toBe("#member-main-content");
    expect(document.querySelector("a")).toBe(skipLink);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  test("activates only recordings on the recordings route", () => {
    renderSidebarAt("/encontros/gravacoes");

    const { links } = personalLinks();
    expect(links[0].getAttribute("data-active")).toBe("true");
    expect(links[1].getAttribute("data-active")).toBe("false");
    expect(links[0].getAttribute("aria-current")).toBe("page");
    expect(links[1].getAttribute("aria-current")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Encontros" })
        .getAttribute("aria-current")
    ).toBeNull();
    expect(document.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  });

  test("activates only saved content on the saved route", () => {
    renderSidebarAt("/comunidade/salvos");

    const { links } = personalLinks();
    expect(links[0].getAttribute("data-active")).toBe("false");
    expect(links[1].getAttribute("data-active")).toBe("true");
    expect(links[0].getAttribute("aria-current")).toBeNull();
    expect(links[1].getAttribute("aria-current")).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Comunidade" })
        .getAttribute("aria-current")
    ).toBeNull();
    expect(document.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  });

  test.each([
    ["/comunidade/meus-topicos", "Meus tópicos"],
    ["/configuracoes", "Configurações"],
    ["/perfil", "Abrir meu perfil"],
  ])("exposes the current page for %s", (pathname, accessibleName) => {
    renderSidebarAt(pathname);

    expect(
      screen
        .getByRole("link", { name: accessibleName })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
});

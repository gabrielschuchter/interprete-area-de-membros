import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  MemberNavigationContext,
  type MemberNavigationContextValue,
  type PortalTransition,
} from "@/app/(authenticated)/components/member-navigation-context";
import { MemberAreaTabs } from "./member-area-tabs";

const navigationState = vi.hoisted(() => ({ pathname: "/estudar" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/(authenticated)/components/intent-link", () => ({
  IntentLink: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

const transition = (
  targetPath: string,
  phase: PortalTransition["phase"]
): PortalTransition => ({
  corridor: null,
  direction: "enter",
  durationMs: 220,
  exitDurationMs: 0,
  href: targetPath,
  id: 1,
  kind: "std",
  phase,
  startedAt: 0,
  targetPath,
  vector: null,
});

const renderTabs = (active: PortalTransition | null) =>
  render(
    <MemberNavigationContext.Provider
      value={
        {
          transition: active,
        } as unknown as MemberNavigationContextValue
      }
    >
      <MemberAreaTabs />
    </MemberNavigationContext.Provider>
  );

const activeTab = () =>
  screen
    .getAllByRole("link", { current: "page" })
    .map((link) => link.textContent)
    .filter((label) => label === "Biblioteca" || label === "Visão geral");

afterEach(() => {
  cleanup();
  navigationState.pathname = "/estudar";
});

describe("MemberAreaTabs", () => {
  test("keeps the committed tab while no navigation is pending", () => {
    renderTabs(null);

    expect(activeTab()).toEqual(["Visão geral"]);
  });

  test("moves the active tab as soon as the click starts a navigation", () => {
    renderTabs(transition("/biblioteca", "leaving"));

    expect(activeTab()).toEqual(["Biblioteca"]);
  });

  test("keeps following the target while the route is committing", () => {
    renderTabs(transition("/biblioteca", "committing"));

    expect(activeTab()).toEqual(["Biblioteca"]);
  });

  test("returns to the committed route once the entry transition runs", () => {
    navigationState.pathname = "/biblioteca";
    renderTabs(transition("/biblioteca", "entering"));

    expect(activeTab()).toEqual(["Biblioteca"]);
  });

  test("opens the lazy area picker with its available destinations", async () => {
    renderTabs(null);

    fireEvent.click(screen.getByRole("button", { name: "Trocar área" }));

    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
    expect(screen.getByRole("navigation", { name: "Estudar" })).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Biblioteca" }).getAttribute("href")
    ).toBe("/biblioteca");
  });
});

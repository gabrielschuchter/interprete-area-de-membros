import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const path = vi.hoisted(() => ({ value: "/cursos" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));

import { RouteMotion } from "./route-motion";

describe("RouteMotion", () => {
  afterEach(() => {
    cleanup();
    path.value = "/cursos";
  });
  test("keeps the portal distinct from destinations hidden before chrome enters", () => {
    path.value = "/";
    const { container } = render(
      <RouteMotion chromeVisible={false}>
        <div>Portal</div>
      </RouteMotion>
    );
    expect(
      container.querySelector(
        '[data-portal-page="true"][data-chrome-visible="false"]'
      )
    ).not.toBeNull();
  });
  test("offers a named, keyboard-focusable target for the skip link", () => {
    render(
      <RouteMotion>
        <main>Conteúdo da página</main>
      </RouteMotion>
    );

    const target = screen.getByRole("region", {
      name: "Conteúdo principal",
    });
    expect(target.id).toBe("member-main-content");
    expect(target.tabIndex).toBe(-1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  test("marks the active route without retaining a second route tree", () => {
    const { container } = render(
      <RouteMotion
        transition={{
          corridor: null,
          direction: "enter",
          durationMs: 220,
          exitDurationMs: 0,
          href: "/ferramentas",
          id: 1,
          kind: "std",
          phase: "entering",
          startedAt: Date.now(),
          targetPath: "/ferramentas",
          vector: null,
        }}
      >
        <main>Conteúdo da página</main>
      </RouteMotion>
    );

    expect(
      container.querySelector(
        '.member-route-page[data-route-transition-kind="std"][data-route-transition-phase="entering"]'
      )
    ).not.toBeNull();
    expect(container.querySelectorAll(".member-route-page")).toHaveLength(1);
  });
});

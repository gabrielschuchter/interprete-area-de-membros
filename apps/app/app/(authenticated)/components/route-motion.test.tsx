import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const path = vi.hoisted(() => ({ value: "/aprender" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));

import { RouteMotion } from "./route-motion";

describe("RouteMotion", () => {
  afterEach(() => {
    cleanup();
    path.value = "/aprender";
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

  test("marks the destination page for the handoff's internal entrance", () => {
    const { container } = render(
      <RouteMotion routeTransitionPhase="entering">
        <main>Conteúdo da página</main>
      </RouteMotion>
    );

    expect(
      container.querySelector(
        '.member-route-page__content[data-route-transition-phase="entering"]'
      )
    ).not.toBeNull();
  });

  test("keeps the previous route inert beneath the entering destination", () => {
    const { container } = render(
      <RouteMotion
        outgoingRoute={{
          pathname: "/planejamento",
          children: <main>Planejamento anterior</main>,
        }}
        routeTransitionPhase="entering"
      >
        <main>Ferramentas</main>
      </RouteMotion>
    );

    const outgoing = container.querySelector(".member-route-page--outgoing");
    const incoming = container.querySelector(".member-route-page--incoming");

    expect(outgoing?.getAttribute("aria-hidden")).toBe("true");
    expect(outgoing?.hasAttribute("inert")).toBe(true);
    expect(outgoing?.textContent).toContain("Planejamento anterior");
    expect(incoming?.textContent).toContain("Ferramentas");
  });
});

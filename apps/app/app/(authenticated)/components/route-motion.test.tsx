import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/aprender" }));

import { RouteMotion } from "./route-motion";

describe("RouteMotion", () => {
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
});

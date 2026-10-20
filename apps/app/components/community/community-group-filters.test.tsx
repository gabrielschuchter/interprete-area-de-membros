import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CommunityGroupFilters,
  type CommunityGroupScope,
} from "./community-group-filters";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  router.push.mockClear();
});

describe("CommunityGroupFilters", () => {
  test("submits a bounded search term in the URL", () => {
    render(<CommunityGroupFilters initialQuery="" initialScope="all" />);
    const input = screen.getByRole("searchbox", {
      name: "Buscar grupos de estudo",
    });
    fireEvent.change(input, { target: { value: "bioestatística" } });
    fireEvent.submit(
      screen.getByRole("form", { name: "Buscar e filtrar grupos de estudo" })
    );

    expect(router.push).toHaveBeenCalledWith(
      `/comunidade/grupos?${new URLSearchParams({ q: "bioestatística" })}`
    );
  });

  test("updates the group scope immediately and preserves the current query", () => {
    const initialScope: CommunityGroupScope = "all";
    render(
      <CommunityGroupFilters
        initialQuery="método"
        initialScope={initialScope}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar grupos" }), {
      target: { value: "discover" },
    });

    const params = new URLSearchParams({ q: "método", scope: "discover" });
    expect(router.push).toHaveBeenCalledWith(
      `/comunidade/grupos?${params.toString()}`
    );
  });
});

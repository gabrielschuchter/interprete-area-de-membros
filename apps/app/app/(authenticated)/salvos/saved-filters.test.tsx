import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { SavedFilters } from "./saved-filters";

const counts = {
  aulas: 2,
  materiais: 3,
  questoes: 4,
  todos: 9,
} as const;

describe("SavedFilters", () => {
  afterEach(() => {
    cleanup();
    router.push.mockClear();
  });

  test("changes category and announces its count", () => {
    render(<SavedFilters counts={counts} selected="todos" />);

    fireEvent.click(screen.getByRole("button", { name: "Questões 4" }));

    expect(router.push).toHaveBeenCalledWith("/salvos?tipo=questoes", {
      scroll: false,
    });
  });

  test("keeps the handoff recent ordering control without inventing choices", () => {
    render(<SavedFilters counts={counts} selected="aulas" />);

    const order = screen.getByLabelText("Ordenar salvos");
    expect(order.getAttribute("disabled")).not.toBeNull();
    expect((order as HTMLSelectElement).value).toBe("recentes");
  });
});

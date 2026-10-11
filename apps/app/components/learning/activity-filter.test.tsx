import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/atividades",
  useSearchParams: () => new URLSearchParams("status=submitted"),
}));

import { ActivityFilter } from "./activity-filter";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("restores the filter from the URL and changes without resetting scroll", () => {
  render(<ActivityFilter />);
  const select = screen.getByLabelText(
    "Mostrar atividades"
  ) as HTMLSelectElement;
  expect(select.value).toBe("submitted");
  fireEvent.change(select, { target: { value: "pending" } });
  expect(router.replace).toHaveBeenCalledWith("/atividades?status=pending", {
    scroll: false,
  });
  fireEvent.change(select, { target: { value: "all" } });
  expect(router.replace).toHaveBeenCalledWith("/atividades", { scroll: false });
});

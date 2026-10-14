import {
  SidebarProvider,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MemberSidebarControl } from "./member-sidebar-control";

const viewport = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@repo/design-system/hooks/use-mobile", () => ({
  useIsMobile: () => viewport.isMobile,
}));

const State = () => {
  const { open, openMobile } = useSidebar();
  return <output data-testid="open-state">{String(open || openMobile)}</output>;
};

const renderControl = (
  isMobile = false,
  mode: "drawer" | "sidebar" = "sidebar",
  defaultOpen = true
) => {
  viewport.isMobile = isMobile;
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <MemberSidebarControl mode={mode} />
      <State />
    </SidebarProvider>
  );
};

afterEach(() => {
  cleanup();
  viewport.isMobile = false;
});

test("collapses and expands the desktop sidebar with an announced action", () => {
  renderControl();

  const collapse = screen.getByRole("button", {
    name: "Recolher barra lateral",
  });
  expect(collapse.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(collapse);

  const expand = screen.getByRole("button", {
    name: "Expandir barra lateral",
  });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(expand);
  expect(
    screen.getByRole("button", { name: "Recolher barra lateral" })
  ).toBeTruthy();
});

test("opens and closes the mobile navigation drawer", () => {
  renderControl(true, "sidebar", false);

  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  const close = screen.getByRole("button", { name: "Fechar menu" });
  expect(screen.getByTestId("open-state").textContent).toBe("true");
  fireEvent.click(close);
  expect(screen.getByRole("button", { name: "Abrir menu" })).toBeTruthy();
  expect(screen.getByTestId("open-state").textContent).toBe("false");
});

test("uses drawer wording for the B2 portal at desktop sizes", () => {
  renderControl(false, "drawer", false);

  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  const close = screen.getByRole("button", { name: "Fechar menu" });
  fireEvent.click(close);
  expect(screen.getByRole("button", { name: "Abrir menu" })).toBeTruthy();
});

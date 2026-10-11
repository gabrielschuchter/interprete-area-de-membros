import {
  SidebarProvider,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberAreaSidebar } from "./member-area-sidebar";

const viewport = vi.hoisted(() => ({ tablet: false, mobile: false }));
vi.mock("@repo/auth/client", () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}));
vi.mock("@repo/design-system/hooks/use-mobile", () => ({
  useIsMobile: () => viewport.mobile,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ prefetch: vi.fn() }),
}));
vi.mock("./intent-link", () => ({
  IntentLink: ({
    children,
    href,
    onNavigationStart: _onNavigationStart,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onNavigationStart?: () => void;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function Controls() {
  const { open, openMobile, toggleSidebar } = useSidebar();
  return (
    <>
      <button onClick={toggleSidebar} type="button">
        Toggle QA
      </button>
      <output data-testid="state">
        {String(viewport.mobile ? openMobile : open)}
      </output>
    </>
  );
}
const content = (portalMode: boolean) => (
  <SidebarProvider>
    <MemberAreaSidebar
      avatarUrl={null}
      canManageContent={false}
      chromeVisible
      displayName="QA"
      email="qa@example.test"
      portalMode={portalMode}
    >
      <Controls />
    </MemberAreaSidebar>
  </SidebarProvider>
);
const originalMatchMedia = window.matchMedia;
const setup = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: viewport.tablet,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  viewport.tablet = false;
  viewport.mobile = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});
describe("member sidebar drawer entry", () => {
  it("closes the mobile drawer with one Escape after focusing a menu link", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
    viewport.mobile = true;
    viewport.tablet = true;
    setup();
    render(content(true));
    fireEvent.click(screen.getByRole("button", { name: "Toggle QA" }));
    const link = screen.getByRole("link", { name: "Estudar" });
    await act(async () => {
      link.focus();
      await Promise.resolve();
    });
    fireEvent.keyDown(link, { key: "Escape" });
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("false")
    );
  });
  it("allows a desktop portal menu to stay open, close and reopen", () => {
    setup();
    render(content(true));
    expect(screen.getByTestId("state").textContent).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Toggle QA" }));
    expect(screen.getByTestId("state").textContent).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.getByTestId("state").textContent).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Toggle QA" }));
    expect(screen.getByTestId("state").textContent).toBe("true");
  });
  it("allows a tablet drawer to stay open", () => {
    viewport.tablet = true;
    setup();
    render(content(false));
    fireEvent.click(screen.getByRole("button", { name: "Toggle QA" }));
    expect(screen.getByTestId("state").textContent).toBe("true");
  });
  it("restores the original desktop sidebar when leaving the portal", () => {
    setup();
    const view = render(content(true));
    view.rerender(content(false));
    expect(screen.getByTestId("state").textContent).toBe("true");
  });
});

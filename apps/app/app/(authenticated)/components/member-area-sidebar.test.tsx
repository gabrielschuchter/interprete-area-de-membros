import {
  SidebarProvider,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
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
  viewport.tablet = false;
  viewport.mobile = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});
describe("member sidebar drawer entry", () => {
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

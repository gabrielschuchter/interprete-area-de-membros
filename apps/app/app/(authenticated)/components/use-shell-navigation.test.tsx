import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGestaoReturnPath } from "../gestao/use-gestao-return-path";
import { useShellNavigation } from "./use-shell-navigation";

const route = vi.hoisted(() => ({ pathname: "/biblioteca", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: route.push }),
}));

const Harness = () => {
  const { navigateShell, feedback } = useShellNavigation();
  return (
    <>
      <button onClick={() => navigateShell("/gestao")} type="button">
        Entrar
      </button>
      {feedback}
    </>
  );
};

describe("Gestão environment navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    route.pathname = "/biblioteca";
    sessionStorage.clear();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete document.documentElement.dataset.shellFallback;
  });

  it("keeps a sanitized source across remounts, and isolates accounts", () => {
    const first = renderHook(() =>
      useGestaoReturnPath("actor-a", "/biblioteca?q=leitura#retomar")
    );
    first.unmount();
    const second = renderHook(() => useGestaoReturnPath("actor-a", null));
    expect(second.result.current).toBe("/biblioteca?q=leitura#retomar");
    second.unmount();
    const other = renderHook(() => useGestaoReturnPath("actor-b", null));
    expect(other.result.current).toBe("/estudar");
    other.unmount();
    sessionStorage.setItem(
      "interprete:gestao:return:v1:actor-a",
      "//external.example"
    );
    const unsafe = renderHook(() => useGestaoReturnPath("actor-a", null));
    expect(unsafe.result.current).toBe("/estudar");
  });

  it("does not dispatch offline and allows a fresh retry", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(<Harness />);
    fireEvent.click(screen.getByText("Entrar"));
    expect(route.push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Confira sua conexão"
    );
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(route.push).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate navigation, releases a stalled request and retries", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Entrar"));
    fireEvent.click(screen.getByText("Entrar"));
    expect(route.push).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Verificando seu acesso…")).toBeTruthy();
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(document.documentElement.dataset.shellTransition).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(route.push).toHaveBeenCalledTimes(2);
  });

  it("falls back when the browser rejects the transition synchronously", () => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: () => {
        throw new Error("Unsupported snapshot");
      },
    });
    render(<Harness />);
    fireEvent.click(screen.getByText("Entrar"));
    expect(route.push).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Verificando seu acesso…")).toBeTruthy();
  });

  it("waits for the rendered title after shell commit, then focuses and announces", async () => {
    const view = render(<Harness />);
    fireEvent.click(screen.getByText("Entrar"));
    route.pathname = "/gestao";
    view.rerender(<Harness />);
    expect(screen.queryByText("Verificando seu acesso…")).toBeNull();
    const main = document.createElement("main");
    main.id = "gestao-main-content";
    main.innerHTML = "<h1>Visão geral</h1>";
    act(() => document.body.append(main));
    // MutationObserver callbacks use a microtask; flush it without advancing timers.
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(main.querySelector("h1"));
    expect(screen.getByText("Você está na Gestão")).toBeTruthy();
    main.remove();
  });
});

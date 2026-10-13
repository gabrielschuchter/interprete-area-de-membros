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
    document.getElementById("gestao-main-content")?.remove();
    document.querySelector("[data-shell-test-dialog]")?.remove();
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

  it("focuses and announces a title rendered after the four-second arrival notice", async () => {
    const view = render(<Harness />);
    fireEvent.click(screen.getByText("Entrar"));
    route.pathname = "/gestao";
    view.rerender(<Harness />);
    expect(screen.queryByText("Verificando seu acesso…")).toBeNull();
    act(() => vi.advanceTimersByTime(6000));
    expect(document.querySelector(".shell-mobile-arrival")).toBeNull();
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

  it("waits for an open dialog to close before focusing the late title", async () => {
    const view = render(<Harness />);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.dataset.state = "open";
    dialog.dataset.shellTestDialog = "";
    dialog.innerHTML = "<button>Fechar</button>";
    document.body.append(dialog);
    dialog.querySelector("button")?.focus();
    route.pathname = "/gestao";
    view.rerender(<Harness />);
    act(() => vi.advanceTimersByTime(6000));
    const main = document.createElement("main");
    main.id = "gestao-main-content";
    main.innerHTML = "<h1>Visão geral</h1>";
    await act(async () => {
      document.body.append(main);
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(dialog.querySelector("button"));
    expect(screen.queryByText("Você está na Gestão")).toBeNull();
    await act(async () => {
      dialog.dataset.state = "closed";
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(main.querySelector("h1"));
    expect(screen.getByText("Você está na Gestão")).toBeTruthy();
  });

  it("cancels a pending focus when navigation leaves that destination", async () => {
    const view = render(<Harness />);
    route.pathname = "/gestao";
    view.rerender(<Harness />);
    act(() => vi.advanceTimersByTime(6000));
    route.pathname = "/gestao/alunos/turmas";
    view.rerender(<Harness />);
    const main = document.createElement("main");
    main.id = "gestao-main-content";
    main.innerHTML = "<h1>Turmas</h1>";
    await act(async () => {
      document.body.append(main);
      await Promise.resolve();
    });
    expect(document.activeElement).not.toBe(main.querySelector("h1"));
    expect(screen.queryByText("Você está na Gestão")).toBeNull();
  });
});

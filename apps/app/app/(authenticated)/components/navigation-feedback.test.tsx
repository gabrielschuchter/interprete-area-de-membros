import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

const navigationState = vi.hoisted(() => ({ pathname: "/origem" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

import { NavigationFeedback } from "./navigation-feedback";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  navigationState.pathname = "/origem";
});

describe("NavigationFeedback", () => {
  test("keeps feedback when the client router prevents native navigation", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="/destino" onClick={(event) => event.preventDefault()}>
          Abrir destino
        </a>
      </>
    );

    fireEvent.pointerDown(screen.getByRole("link", { name: "Abrir destino" }));
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));

    expect(screen.getByText("Abrindo conteúdo")).toBeTruthy();
  });

  test("does not show navigation feedback for modified link activation", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="/destino" onClick={(event) => event.preventDefault()}>
          Abrir destino
        </a>
      </>
    );

    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }), {
      ctrlKey: true,
    });

    expect(screen.queryByText("Abrindo conteúdo")).toBeNull();
  });

  test("acknowledges a keyboard-generated internal link click", () => {
    render(
      <>
        <NavigationFeedback />
        <a href="/destino" onClick={(event) => event.preventDefault()}>
          Abrir destino
        </a>
      </>
    );

    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }), {
      detail: 0,
    });

    expect(screen.getByText("Abrindo conteúdo")).toBeTruthy();
  });

  test("keeps the acknowledgement visible briefly when the route commits immediately", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <>
        <NavigationFeedback />
        <a href="/destino">Abrir destino</a>
      </>
    );

    fireEvent.pointerDown(screen.getByRole("link", { name: "Abrir destino" }));
    navigationState.pathname = "/destino";
    rerender(
      <>
        <NavigationFeedback />
        <a href="/destino">Abrir destino</a>
      </>
    );

    expect(screen.getByText("Abrindo conteúdo")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.queryByText("Abrindo conteúdo")).toBeNull();
  });
});

import { AuthLoadingState } from "@repo/auth/components/auth-loading-state";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("shows a retry action when Clerk never finishes loading", async () => {
  vi.useFakeTimers();
  render(<AuthLoadingState loadingLabel="Carregando acesso…" />);

  expect(screen.getByRole("status").textContent).toContain("Carregando acesso");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000);
  });

  expect(screen.getByRole("alert").textContent).toContain(
    "serviço de autenticação demorou para responder"
  );
  expect(
    screen.getByRole("button", { name: "Tentar novamente" })
  ).toBeDefined();
});
